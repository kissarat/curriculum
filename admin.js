const
    config = require('./config'),
    http = require('http'),
    url = require('url');

const deny = {
    process: ['abort', 'exit'],
    os: ['getNetworkInterfaces', 'EOL']
};

module.exports = function(req, res) {
    const loc = url.parse(req.url);
    const p = loc.pathname.slice(1).split('/');
    function tablet(obj) {
        var table = ['<table border="1">'];
        var object_deny = deny[Object == obj.constructor
            ? p[0] : obj.constructor.name] || [];
        for(var key in obj)
            if (object_deny.indexOf(key) < 0) {
                var val = obj[key];
                if ('os' == p[0])
                    switch (key) {
                        case 'freemem':
                        case 'totalmem':
                            val = val();
//                            val = val.toString();
//                            val = val.split('');
//                            val = val.reverse();
//                            var v = [];
//                            for(var i=0; i<value.length; i+=3) {
//                                var peace = val.slice(i, i+3);
//                                peace.push(' ');
//                                v.push(peace);
//                            }
//                            val = v.reverse();
//                            val = val.join('');
                            val = val / 1024 / 1024;
                            val = Math.round(val);
                            val += 'M';
                    }
                table.push('\t<tr><td>'
                    + key + '</td><td>'
                    + stringify(val) + '</td></tr>\n');
            }
        table.push('</table>\n\n');
        return table.join('');
    }
    function stringify(o) {
        switch (typeof o) {
            case 'function':
                return stringify(o());
            case 'object':
                return tablet(o);
            case 'undefined':
            case 'null':
                return '';
            default:
                return o;
        }
    }

    var m;
    try {
        if ('process' == p[0])
            m = process;
        else
            m = require(p[0]);
    }
    catch(err) {
        res.writeHeader(404);
        res.end(err.code);
        return;
    }
    res.setHeader('content-type', 'text/html');
    if(p[1])
        res.end(stringify(m[p[1]]()));
    else {
//        res.write('<html><head><style type="text/css">td {border: 1px solid gray}</style></head><body>');
        res.end(tablet(m));
//        res.end('</body></html>');
    }
};

if (config.admin.enable && require.main == module)
    http.createServer(module.exports)
        .listen(config.admin.port, config.admin.host);