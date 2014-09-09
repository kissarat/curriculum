const
    config = require('../config'),
    dataset = require('./dataset'),
    http = require('http'),
    qs = require('querystring');

var req = http.request({
    host: config.http.host,
    port: config.http.port,
    path: '/member',
    method: 'POST'
}, function(res) {
    res.on('data', function(data) {
        console.log(data.toString());
    });
    res.on('end', function() {
        process.exit();
    });
});

var data = {
    first_name: dataset.rand('first_names'),
    last_name: dataset.rand('last_names'),
    kind: dataset.rand([0, 1, 2])
};
data.email = data.first_name + '_' + data.last_name + '@gmail.com';

data = qs.stringify(data);
req.end(data);