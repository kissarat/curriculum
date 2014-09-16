const
    config = require('../config'),
    dataset = require('./dataset'),
    unix_error = require('../unix_error'),
    clc = require('cli-color'),
    http = require('http'),
    pg = require('pg'),
    qs = require('querystring');

const entity = process.argv[2] || 'member';
const number = process.argv[3] || 1;
var cookies = {};
var db;

function connect_db(call) {
    if (db)
        return;
    db = new pg.Client(config.db);
    db.connect(function(err) {
        if (err)
            return console.error(err);
        call();
    });
}

function populate(array, number) {
    for(var i=0; i<number; i++)
        array.push(array[i]);
}

function formNumber(number, width) {
    if (!width)
        width = 2;
    return ('0000' + number).slice(-width);
}

function property_list(array, property) {
    if (!property)
        property = 'id';
    var result = [];
    for(var i in array)
        result.push(array[i][property]);
    return result;
}

function rand_id(table, call) {
    db.query('select id from ' + table + ' order by random() limit 1', function(err, result) {
        if (err)
            console.error(clc.red(err));
        else
            call(result.rows[0].id);
    });
}

function formatDate(d) {
    if (!d)
        d = new Date();
    return d.getFullYear()
        + '-' + formNumber(d.getMonth() + 1)
        + '-' + formNumber(d.getDate())
        + ' ' + formNumber(d.getHours())
        + ':' + formNumber(d.getMinutes())
        + ':' + formNumber(d.getSeconds());
}

function error(err) {
    var message = unix_error[err.code];
    if (!message)
        message = err;
    message = clc.red(message);
    console.error(message);
}

function rand(max) {
    return Math.floor(Math.random() * max);
}

function generate(i) {
    var req = http.request({
        host: config.http.host,
        port: config.http.port,
        path: '/' + entity,
        method: 'POST'
    }, function (res) {
        res.on('error', error);
        res.on('data', function (data) {
            console.log(clc.blueBright(i) + ' ' + data.toString());
        });
        res.on('end', function () {
            i--;
            if (i > 0)
                generate(i);
            else
                process.exit();
        });
        (res.headers['set-cookie'] || []).forEach(function(cookie) {
            cookie = cookie.split(';');
            cookie = cookie[0].split('=');
            cookies[cookie[0]] = cookie[1];
        });
    });

    var data;
    switch (entity) {
        case 'doc':
            data = function(call) {
                rand_id('subject', function(subject) {
                    var link = dataset.rand('links');
                    call({
                        subject: subject,
                        name: link[0],
                        link: link[1]
                    });
                });
            };
            break;
        case 'member':
            data = {
                first_name: dataset.rand('first_names'),
                last_name: dataset.rand('last_names'),
                kind: dataset.rand([0, 1, 2])
            };
            data.email = data.first_name + '_' + data.last_name + '@gmail.com';
            break;
        case 'notification':
            data = function(call) {
                rand_id('subject', function(subject) {
                    rand_id('member', function(member) {
                        const now = Date.now();
                        call({
                            subject: subject,
                            whom: member,
                            when: formatDate(new Date(now + Math.random()*10*1000*1000*1000)),
                            body: dataset.multiple('sentences', 2).join('. ')
                        });
                    });
                });
            };
            break;
        case 'subject':
            data = {
                name: dataset.rand('cities'),
                color: rand(256) * 0xFFFF + rand(256) * 0xFF + rand(256)
            };
            break;
        default:
            console.error('Unknown entity ' + entity);
            process.exit();
            break;
    }

    function request(d) {
        d = qs.stringify(d);
        req.setHeader('cookie', qs.stringify(cookies, '; '));
        req.on('error', error);
        req.end(d);
    }

    if ('function' == typeof data)
        data(request);
    else
        request(data);
}

if (['doc', 'notification'].indexOf(entity) >= 0)
    connect_db(generate.bind(this, number));
else
    generate(number);