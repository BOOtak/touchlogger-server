"use strict";

var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var constants = require('constants');
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;

var url = 'mongodb://localhost:27017/thesis';

var insertDocument = function(db, gestures, callback) {
    db.collection('gestures').insertMany(gestures, function(err, result) {
        assert.equal(err, null);
        console.log("Inserted a document into the gestures collection.");
        callback(result);
    });
};

var server = http.createServer( function(req, res) {

    console.dir(req.param);

    if (req.method == 'POST') {
        console.log("POST");
        let body = '';
        req.on('data', function (data) {
            body += data;
            // console.log("Partial body: " + body);
        });
        req.on('end', function () {
            // console.log("Body: " + body);
            let payload = JSON.parse(body);
            if (process.env.PRIVATE_KEY_PATH === undefined) {
                console.error("Set PRIVATE_KEY_PATH to valid path to RSA PEM key");
            }

            let privateKeyString = fs.readFileSync(process.env.PRIVATE_KEY_PATH, { encoding: 'utf8' });
            let privateKey = {
                "key": privateKeyString,
                "padding": constants.RSA_PKCS1_PADDING
            };
            let sessionKey = crypto.privateDecrypt(privateKey, new Buffer(payload.session_key, 'base64'));
            let decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, new Buffer(payload.iv, 'base64'));
            let decdata = decipher.update(new Buffer(payload.data, 'base64'));
            decdata += decipher.final();

            let ts = Date.now();
            let gestures = JSON.parse(decdata.toString('utf-8'));

            for (var i = 0; i < gestures.length; i++) {
                gestures[i].timestamp = new Date(gestures[i].timestamp);
                gestures[i].deviceId = payload.device_id;
            };

            MongoClient.connect(url, function(err, db) {
                assert.equal(null, err);
                insertDocument(db, gestures, function() {
                    db.close();
                });
            });

            fs.writeFile(`/home/kirill/log${ts}.data`, decdata.toString('utf-8'), function (err) {
                if (err) {
                    throw err;
                };
                console.log("File saved.");
            });
        });
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('post received');
    }
    else
    {
        console.log("GET");
        // var html = '<html><body><form method="post" action="http://localhost:3000">Name: <input type="text" name="name" /><input type="submit" value="Submit" /></form></body>';
        var html = fs.readFileSync('index.html');
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(html);
    }

});

var port = 9002;
var host = '0.0.0.0';
server.listen(port, host);
console.log('Listening at http://' + host + ':' + port);
