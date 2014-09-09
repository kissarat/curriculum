const
    config = require('./config'),
    clc = require('cli-color'),
    crypto = require('crypto'),
    fs = require('fs'),
    http = require('http'),
    url = require('url'),
    pg = require('pg'),
    qs = require('querystring');

Object.freeze(config);
const db = new pg.Client(config.db);
const entities = [];
const member_kind = {
    admin: 0,
    student: 1,
    teacher: 2
};
Object.freeze(member_kind);

function debug(message) {
    console.log(clc.yellow(message));
}

const server = http.createServer(function(req, res) {

    if (req.url.indexOf('.') >= 0) {
        res.writeHead(404);
        return res.end();
    }

    debug(req.url);
    var session;
    if (session = req.headers['cookie'])
        session = qs.parse(session, '; ');
    else
        session = {
            salt: null
        };

    function store(data) {
        for(var key in data) {
            var value = data[key];
            session[key] = value;
            value = 'string' == typeof value
                ? key + '=' + value + '; path=/'
                : qs.stringify(value, '; ');
            res.setHeader('set-cookie', value);
        }
    }

    function json(data, err) {
        if (err) {
            res.writeHead(502);
//            console.error(clc.red(JSON.stringify(err)));
            console.error(err);
        }
        res.end(JSON.stringify({
            data: data,
            error: err
        }));
        access_log(err);
    }

    function error(message) {
        json(null, message);
    }

    function wrap(call) {
        return function(err, data) {
            if (err)
                json(null, err);
            else
                call(data);
        }
    }

    function query(sql, call) {
        if (!call)
            call = function(result) {
                json(result.rows);
            };
        var filter;
        var callback = call;
        if (route && (filter = route.filter || route[req.method].filter)) {
            callback = function(result) {
                result.rows.forEach(filter);
                call(result);
            };
        }
        debug('\t' + sql + ';');
        db.query(sql, wrap(callback));
    }

    function single(error_msg, call) {
        if (!error_msg)
            error_msg = 'More than one ' + entity + ' found';
        if (!call)
            call = json;
        return function(result) {
            if (1 == result.rowCount)
                call(result.rows[0]);
            else
                error(error_msg);
        }
    }

    function login(call) {
        if (config.test.enable && !session.salt) {
            session = {id:config.test.member};
            const callback = call;
            call = function(member) {
                store({salt:member.salt});
                callback(member);
            }
        }
        query(select({table: 'member', where: session}), single('You must be authorized', call));
    }

    function optional(params, dst, src) {
        if (!src)
            src = loc.query;
        if (!dst)
            dst = {};
        for(var i in params)
            if (undefined !== src[params[i]])
                dst[src[params[i]]] = src[params[i]];
        return dst;
    }

    function correct(_) {
        if (!_.table)
            _.table = q(entity);
        if (!_.where)
            _.where = loc.query;
        _.where = _.where ? 'where ' + q_object(_.where) : '';
    }

    function select(_) {
        correct(_);
        if ('string' != typeof _.fields) {
            //_.fields = concat(_.fields, route[req.method].fields);
            _.fields = _.fields ? q(_.fields).join() : '*';
        }
        var sql = ['select', _.fields, 'from', _.table, _.where];
        return sql.join(' ');
    }

    function insert(_) {
        correct(_);
        var sql = ['insert into', _.table,
            '(', q(Object.keys(_.data)).join(), ')',
            'values (', q(values(_.data), "'").join(), ')'];
        return sql.join(' ');
    }

    function remove(_) {
        correct(_);
        var sql = ['delete from', _.table, _.where];
        return sql.join(' ');
    }

    function concat() {
        var array = [];
        for(var i in arguments)
            if (arguments[i] instanceof Array)
                array = array.concat(arguments[i]);
        return array;
    }

    function object() {
        var obj = {};
        for(var i in arguments) {
            var arg = arguments[i];
            if ('function' == typeof arg)
                arg = arg();
            if ('object' == typeof arg)
                for(var key in arg)
                    obj[key] = arg[key];
        }
        return obj;
    }

    function access_log(message) {
        var file = me ? me.id : 'anonymous';
        var row = [Date.now(), req.connection.remoteAddress, req.method, req.url];
        if (message)
            row.push(message);
        fs.appendFile('log/' + file, row.join('\t') + '\n');
    }

    const defaults = {
        GET: function() {
            var callback = route[req.method].single ? single() : null;
            query(select({where: optional(
                concat(route.optional, route[req.method].optional),
                object(route.assign, route[req.method].assign)
            )}), callback);
        },

        POST: function() {
            var filter = route.POST.filter;
            if (filter)
                filter(req.data);
            query(insert({data:req.data}));
        },
        DELETE: function() {
            query(remove({where: optional(
                concat(this.optional, route.optional))}));
        }
    };

    var me;
    var route;

    const routes = {
        auth: {
            POST: function(data) {
                data.password = decodeURIComponent(data.password);
                data.password_hash = hash(data.password);
                delete data.password;
                query(select({fields: 'salt'}), single('No such user or password',
                    function(member) {
                        store(member);
                        json(member);
                    })
                );
            }
        },

        log: {
            GET: function() {
                fs.readFile('log', function(data) {
                    res.setHeader('content-type', 'text/plain');
                    res.end(data);
                })
            }
        },

        member: {
            filter: function(member) {
                member.id = member.id.trim();
            },

            GET: {
                single: true,
                assign: function() {
                    return {id:me.id};
                },
                fields: ['id', 'email', 'first_name', 'last_name']
            },

            POST: function(data) {
                if (!data.id)
                    data.id = slice_id(data.last_name + '_' + data.first_name);
                if (!data.password)
                    data.password = salt(null, config.session.chars);
                data.password_hash = hash(data.password);
//                delete data.password;
                data.salt = salt(rand(12, 32), config.session.chars);
                data.kind = parseInt(data.kind);
//                if (kind = parseInt(data.kind))
//                    data.kind = kind;
//                else
//                    data.kind = member_kind[data.kind];
                query(insert({data:data}), function() {
                    query(select({fields: ['id', 'kind'], where:{id:data.id}}),
                        single('User did not created', json));
                });
            }
        },

        subject: {
            POST:{
                filter: function(subject) {
                    if(subject.id)
                        subject.id = subject.id.trim();
                    else
                        subject.id = slice_id(subject.name);
                    subject.color = parseInt(subject.color);
                }
            }
        },

        notification: {
            assign: function() {
                return { whom:me.id };
            },
            optional: ['id'],

            GET: {},
            POST: {
                role: member_kind.teacher
            },
            DELETE: {}
        },

        doc: {
            optional: ['id', 'subject', 'name'],

            GET: {},
            POST: {
//                role: member_kind.teacher
            },
            DELETE: {
                role: member_kind.teacher
            }
        }
    };

    const loc = url.parse(req.url);
    const entity = loc.pathname.slice(1);
    var handler;
    if (entity) {
        if (entities.indexOf(entity) < 0 && Object.keys(routes).indexOf(entity) < 0)
            return error('No such entity ' + entity);
        if (!routes[entity] || !routes[entity][req.method])
            return error('No ' + req.method + ' handler for ' + entity);
        else {
            route = routes[entity];
            handler = route[req.method];
        }
    }
    if (loc.query)
        loc.query = qs.parse(loc.query);
    login(function(member) {
        me = member;

        switch (typeof handler) {
            case 'string':
                return json(null, handler);
            case 'object':
                if (handler.role && !(me.kind & handler.role))
                    return json(null, 'Access deny');
                handler = handler.method;
                if (!handler)
                    handler = defaults[req.method];
        }

        switch (req.method) {
            case 'POST':
                req.data = [];
                req.on('data', function(data) {
                    req.data.push(data);
                });
                req.on('end', function() {
                    req.data = req.data.join('');
                    req.data = qs.parse(req.data);
                    handler(req.data);
                });
                break;
            case 'DELETE':
//                if (handler instanceof Array)
//                    for(var i in loc.query) {
//                        var param = loc.query[i];
//                        if (handler.indexOf(param) >=0)
//
//                    }
                handler();
                break;
            case 'GET':
            default:
                if (!entity)
                    return json(entities);
               // query('select * from ' + q(entity));
                handler.call(route.GET);
                break;
        }
    });
});


function values(data) {
    var result = [];
    for(var key in data)
        result.push(data[key]);
    return result;
}

function q(str, quote) {
    if (!quote)
        quote = '"';
    if ('number' == typeof str)
        return str;
    else if (undefined === str || null === str)
        return 'null';
    else if (str instanceof Array) {
        for(var i in str)
            str[i] = q(str[i], quote);
        return str;
    }
    else
        return quote + str + quote;

}

function slice_id(str) {
    if (str.length > 16)
        str = str.slice(0, 16);
    str = str.replace(/\s+/g, '_');
    return str.toLowerCase();
}

function q_object(obj) {
    var result = [];
    for(var key in obj)
        result.push(q(key) + '=' + q(obj[key], "'"));
    return result.join(' and ');
}

function hash(password) {
    const h = crypto.createHash(config.password.hash);
    h.update(password);
    return h.digest('base64');
}

function rand(min, max) {
    if ('number' != typeof max) {
        max = min;
        min = 0;
    }
    return min + Math.floor((max - min)*Math.random());
}

function salt(length, chars) {
    const _ = config.password;
    length = length || rand(_.min, _.max);
    chars = chars || _.chars;
    var password = [];
    for(var i=0; i<length; i++)
        password.push(chars[rand(chars.length)]);
    return password.join('');
}

db.connect(function(err) {
    if (err)
        return console.error(err);
    db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'", function(err, result) {
        for(var i in result.rows)
            entities.push(result.rows[i]['table_name']);
    });
//    console.error('\033[31m');
    server.listen(config.http.port, config.http.host);
});