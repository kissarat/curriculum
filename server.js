const
    config = require('./config'),
    clc = require('cli-color'),
    crypto = require('crypto'),
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
    debug(req.url);
    var session;
    if (session = req.headers['Cookie'])
        session = qs.parse(session, '; ');
    else
        session = {
            salt: null
        };

    function store(data) {
        for(var key in data) {
            var value = data[key];
            value = 'string' == typeof value
                ? key + '=' + value + '; path=/'
                : qs.stringify(value, '; ');
            res.setHeader('Set-Cookie', value);
        }
    }

    function json(data, error) {
        if (error)
            res.writeHead(404);
        res.end(JSON.stringify({
            data: data,
            error: error
        }));
    }

    function error(message) {
        json(null, message);
    }

    function wrap(call) {
        return function(err, data) {
            if (err) {
                console.error(err);
                json(null, err);
                return;
            }
            call(data);
        }
    }

    function query(sql, call) {
        call = call ? wrap(call) : wrap(function(result) {
            json(result.rows);
        });
        debug(sql);
        db.query(sql, call);
    }

    function single(error_msg, call) {
        return function(result) {
            if (1 == result.rowCount)
                call(result.rows[0]);
            else
                error(error_msg);
        }
    }

    function login(call) {
        query(select('member', session), single('You must be authorized', call));
    }

    function select(entity, where) {
        var sql = ['select * from', q(entity), 'where',
            q_object(where)];
        return sql.join(' ');
    }

    function insert(entity, data) {
        var sql = ['insert into', q(entity),
            '(', q(Object.keys(data)).join(), ')',
            'values (', q(values(data), "'").join(), ')'];
        return sql.join(' ');
    }

    var me;

    const route = {
        auth: {
            POST: function(data) {
                data.password = decodeURIComponent(data.password);
                data.password_hash = hash(data.password);
                delete data.password;
                query(select('member', data), single('No such user or password',
                    function(member) {
                        const salt = {salt: member.salt};
                        store(salt);
                        json(salt);
                    })
                );
            }
        },

        member: {
            POST: function(data) {
                if (!data.id)
                    data.id = (data.first_name + '_' + data.last_name)
                        .toLocaleLowerCase();
                if (!data.password)
                    data.password = salt();
                data.password_hash = hash(data.password);
//                delete data.password;
                data.salt = salt(rand(12, 48), config.session.chars);
                var kind;
                if (kind = parseInt(data.kind))
                    data.kind = kind;
                else
                    data.kind = member_kind[data.kind];
                query(insert('member', data), json.bind(this, data));
            }
        },

        notification: {
            GET: function() {
                query(select('notification', {whom:me.id}));
            },
            POST: function(data) {
                if (member_kind.teacher == me.kind)
                    query(insert('notification', data));
                else
                    error('Only teachers can send notifications');
            },
            DELETE: function() {
                error('Not implemented');
            }
        }
    };

    const loc = url.parse(req.url);
    const entity = loc.pathname.slice(1);
    var handler;
    if (entity) {
        if (entities.indexOf(entity) < 0 && Object.keys(route).indexOf(entity) < 0)
            return error('No such entity ' + entity);
        if (!route[entity] || !route[entity][req.method])
            return error('No ' + req.method + ' handler for ' + entity);
        else
            handler = route[entity][req.method];
    }
    if (loc.query)
        loc.query = qs.parse(loc.query);
    login(function(member) {
        me = member;
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
            case 'GET':
            default:
                if (!entity)
                    return json(entities);
                query('select * from ' + q(entity));
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
    if (str instanceof Array) {
        for(var i in str)
            str[i] = q(str[i], quote);
        return str;
    }
    if ('number' != typeof str)
        str = quote + str + quote;
    return str;
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
        console.error(err);
    db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'", function(err, result) {
        for(var i in result.rows)
            entities.push(result.rows[i]['table_name']);
    });
    server.listen(config.http.port, config.http.host);
});