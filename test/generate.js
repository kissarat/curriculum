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
            console.log(data.toString());
        });
        res.on('end', function () {
            if (i > 0)
                generate(--i);
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
        case 'init':
            data = function(call) {
                db.query('insert into member(id,password,email,first_name,last_name)', function(err, result) {
                    var link = dataset.rand('links');
                    call({
                        subject: result.rows[0].id,
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
        case 'subject':
            data = {
                name: dataset.rand('cities'),
                color: rand(256) * 0xFFFF + rand(256) * 0xFF + rand(256)
            };
            break;
        case 'doc':
            data = function(call) {
                db.query('select id from subject order by random() limit 1', function(err, result) {
                    var link = dataset.rand('links');
                    call({
                        subject: result.rows[0].id,
                        name: link[0],
                        link: link[1]
                    });
                });
            };
            break;
        default:
            console.error('Unknown entity ' + entity);
            process.exit();
            break;
    }

    function request(d) {
        d = d ? qs.stringify(d) : null;
        req.setHeader('cookie', qs.stringify(cookies, '; '));
        req.on('error', error);
        req.end(d);
    }

    if ('function' == typeof data)
        data(request);
    else
        request(data);
}

if (['doc'].indexOf(entity) >= 0)
    connect_db(generate.bind(this, number));
else
    generate(number);