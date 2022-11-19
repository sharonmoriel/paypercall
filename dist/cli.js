#!/usr/bin/env node
'use strict';

var args = require('meow')('\n    Usage\n      $ paypercall [options]\n\n    Options\n      -c, --charge-url <url>      lightning charge server url [default: http://localhost:9112]\n      -t, --charge-token <token>  lightning charge access token [required]\n\n      -u, --upstream-url <url>    the upstream server to reverse proxy [required]\n      -r, --rates-path <path>     path to YAML file mapping from endpoints to rates [default: ./rates.yaml]\n      -y, --rates-yaml <yaml>     YAML string to use instead of reading from {rates-path}\n      -x, --currency <name>       default rate currency if none is specified [default: BTC]\n      -d, --db-path <path>        path to store sqlite database [default: ./payperclick.db]\n\n      --invoice-expiry <sec>      how long should invoices be payable for [default: 1 hour]\n      --access-expiry <sec>       how long should paid access tokens remain valid for [default: 1 hour]\n      --token-secret <secret>     secret key used for HMAC tokens [default: generated based on {charge-token}]\n\n      -p, --port <port>           http server port [default: 4000]\n      -i, --host <host>           http server listen address [default: 127.0.0.1]\n      -e, --node-env <env>        nodejs environment mode [default: production]\n      -h, --help                  output usage information\n      -v, --version               output version number\n\n    Example\n      $ payperclick -t myAccessToken -u http://upstream-server.com/ \\\n                    -y \'{ POST /sms: 0.0001 BTC, PUT /page/:id: 0.0002 BTC }\'\n\n', { flags: { chargeUrl: { alias: 'c' }, chargeToken: { alias: 't' },
    upstreamUrl: { alias: 'u' }, ratesPath: { alias: 'r' }, ratesYaml: { alias: 'y' },
    currency: { alias: 'x' }, dbPath: { alias: 'd' },
    port: { alias: 'p' }, host: { alias: 'i' }, nodeEnv: { alias: 'e' } } }).flags;

Object.keys(args).filter(function (k) {
  return k.length > 1;
}).forEach(function (k) {
  return process.env[k.replace(/([A-Z])/g, '_$1').toUpperCase()] = args[k];
});

require('./reverse-proxy');