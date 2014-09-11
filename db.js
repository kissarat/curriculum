const
    pg = require('pg');

global.extend = function(source, target) {
    if (!target)
        target = global;
    for(var key in source)
        target[key] = source[key];
};

const include = function(name) {
    return Object.freeze(require(name));
};

const
    config = include('./config'),
    unix_error = include('./unix_error'),
    init = include('./test/init');
module.exports = {
  isGlobal: this == global,
    keys: Object.keys(this),
    self: this,
    mod: module
};

function correct(_) {
    if (!_.table)
        _.table = q(entity);
    if (!_.where)
        _.where = loc.query;
    _.where = _.where ? 'where ' + q_object(_.where) : '';
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

function q_object(obj, sep) {
    var result = [];
    for(var key in obj)
        result.push(q(key) + '=' + q(obj[key], "'"));
    return result.join(sep || ' and ');
}

extend({
    correct: correct,
    q: q,
    q_object: q_object,

    connect: function(config, call) {
        const db_pg = new pg.Client(config);
        db_pg.connect(function(err) {
            if (err)
                return console.error(err);
            call()
        });
        this.__proto__ = db_pg;
    },

    select: function(_) {
        correct(_);
        if ('string' != typeof _.fields) {
            //_.fields = concat(_.fields, route[req.method].fields);
            _.fields = _.fields ? q(_.fields).join() : '*';
        }
        var sql = ['select', _.fields, 'from', _.table, _.where];
        return sql.join(' ');
    },

    insert: function(_) {
        correct(_);
        var sql = ['insert into', _.table,
            '(', q(Object.keys(_.data)).join(), ')',
            'values (', q(values(_.data), "'").join(), ')'];
        return sql.join(' ');
    },

    update: function(_) {
        correct(_);
        var sql = ['update', _.table, 'set',
            q_object(_.data, ','), _.where];
        return sql.join(' ');
    },

    remove: function(_) {
        correct(_);
        var sql = ['delete from', _.table, _.where];
        return sql.join(' ');
    }
});