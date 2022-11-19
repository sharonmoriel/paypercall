'use strict';

var _crypto = require('crypto');

var _path = require('path');

var _onFinished = require('on-finished');

var _onFinished2 = _interopRequireDefault(_onFinished);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

require('babel-polyfill');

module.exports = function (opt) {
  var db = opt.db || require('knex')({ client: 'sqlite3', connection: opt.dbPath || 'paypercall.db', useNullAsDefault: true }),
      charge = opt.charge || require('lightning-charge-client')(opt.chargeUrl, opt.chargeToken),
      secret = opt.secret || opt.chargeToken && (0, _crypto.createHmac)('sha256', opt.chargeToken).update('paypercall-secret').digest() || function (_) {
    throw new Error('secret or chargeToken are required');
  }();

  var invoiceExp = +opt.invoiceExp || 60 * 60,
      accessExp = +opt.accessExp || 60 * 60,
      defCurrency = opt.currency || 'BTC';

  // HMAC tokens
  var hmac = function hmac(req, invid) {
    return (0, _crypto.createHmac)('sha256', secret).update([invid, req.method, req.path].join(' ')).digest().toString('base64').replace(/\W+/g, '');
  };

  var makeToken = function makeToken(req, invid) {
    return [invid, hmac(req, invid)].join('.');
  };
  var parseToken = function parseToken(req) {
    var t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : req.get('X-Token').split('.');
    return hmac(req, t[0]) === t[1] && t[0];
  };

  // Database
  var markSpent = function markSpent(inv) {
    return db('spent').insert({ status: 'processing', invid: inv.id, paid_at: inv.paid_at }).catch(function (err) {
      return false;
    });
  },
      markDone = function markDone(inv, res) {
    return db('spent').update({ status: 'done', res: res._header }).where({ invid: inv.id, status: 'processing' });
  };

  db.migrate.latest({ directory: (0, _path.join)(__dirname, '..', 'migrations') }).then(function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return db('spent').where('paid_at', '<', (0, _util.now)() - accessExp - 604800).delete();

            case 2:
              setTimeout(cleanup, 36000000); // every 10 hours

            case 3:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    function cleanup() {
      return _ref.apply(this, arguments);
    }

    return cleanup;
  }());

  // Middleware
  return function () {
    return (0, _util.pwrap)(function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(req, res, next) {
        var invid, inv, paid, amount, currency, description, _inv;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                invid = req.get('X-Token') && parseToken(req);
                _context3.t0 = invid;

                if (!_context3.t0) {
                  _context3.next = 6;
                  break;
                }

                _context3.next = 5;
                return charge.fetch(invid);

              case 5:
                _context3.t0 = _context3.sent;

              case 6:
                inv = _context3.t0;
                paid = inv && inv.status === 'paid' && inv.paid_at > (0, _util.now)() - accessExp;

                if (!paid) {
                  _context3.next = 18;
                  break;
                }

                _context3.next = 11;
                return markSpent(inv);

              case 11:
                if (_context3.sent) {
                  _context3.next = 13;
                  break;
                }

                return _context3.abrupt('return', res.status(410).send('Error: payment token already spent'));

              case 13:

                (0, _onFinished2.default)(res, function () {
                  var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(_) {
                    return regeneratorRuntime.wrap(function _callee2$(_context2) {
                      while (1) {
                        switch (_context2.prev = _context2.next) {
                          case 0:
                            _context2.next = 2;
                            return markDone(inv, res);

                          case 2:
                            return _context2.abrupt('return', _context2.sent);

                          case 3:
                          case 'end':
                            return _context2.stop();
                        }
                      }
                    }, _callee2, undefined);
                  }));

                  return function (_x5) {
                    return _ref3.apply(this, arguments);
                  };
                }());
                req.invoice = inv;
                next();
                _context3.next = 25;
                break;

              case 18:
                amount = req.params.amount;
                currency = req.params.currency || defCurrency;
                description = req.body.description || 'Pay to call ' + req.method + ' ' + req.path;
                _context3.next = 23;
                return charge.invoice({
                  amount: amount, currency: currency,
                  metadata: { source: 'paypercall', req: (0, _util.only)(req, 'method', 'path') },
                  description: description,
                  expiry: invoiceExp
                });

              case 23:
                _inv = _context3.sent;


                res.status(402) // Payment Required
                .type('application/vnd.lightning.bolt11').set('X-Token', makeToken(req, _inv.id)).send(_inv.payreq);

              case 25:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, undefined);
      }));

      return function (_x2, _x3, _x4) {
        return _ref2.apply(this, arguments);
      };
    }());
  };
};