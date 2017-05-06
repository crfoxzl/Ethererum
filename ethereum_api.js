#!/usr/bin/env nodejs

// TODO:
// (1) V Unlock Account on login
// (2) V Lock Account on logout
// (3) Transfer
// (4) Admin-logout
// (5) Auto-logout
// (6) Init balance: 1000 eth
// (7) Drop accounts(Mongo, Geth)
// (8) Inter-Machine operation by WebSocket
// (9) Restful API

var Web3 = require('web3');
var mongodb = require('mongodb');
var express = require('express');
var spawn = require('child_process').spawn;

const NODE_IDENTITY = 'Node01';
const BLOCK_DATA_DIR = '/home/pc193/ethereum/chain1/';
const GETH_LISTEN_PORT = '30303';
const RPC_PORT = '8545';
const RPC_URL = '127.0.0.1:' + RPC_PORT;
const RPC_DOMAIN = '*';
const RPC_API = 'db,eth,net,web3,personal';
const NETWORK_ID = 196876;

var mongodbServer = new mongodb.Server('localhost', 27017, { auto_reconnect: true });
var account_db = new mongodb.Db('account_db', mongodbServer);
var app = express();
var startGethCmd;
var createAccountCmd;
var unlockAccountCmd;
var lockAccountCmd;

startGethCmd = spawn('geth', ['--identity', NODE_IDENTITY, '--rpc', '--rpcport', RPC_PORT, '--rpccorsdomain', RPC_DOMAIN, '--datadir', BLOCK_DATA_DIR, '--port', GETH_LISTEN_PORT, '--rpcapi', RPC_API, '--networkid', NETWORK_ID]);

// startGethCmd.stdout.on('data', function (data) {
// 	console.log('stdout: ' + data.toString());
// });

// startGethCmd.stderr.on('data', function (data) {
// 	console.log('stderr: ' + data.toString());
// });

startGethCmd.on('exit', function (code) {
	console.log('Geth child process exited with code ' + code.toString());
});

var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

function writeResponse(resp, result) {
	resp.send("" + JSON.stringify(result));
}

function onCreate(req, resp) {
	if (!req.query.a_id) {
		writeResponse(resp, { Success: false, Err: "a_id not specified."});
		return;
	}

	account_db.open(function(err, account_db) {
		if (err) {
			console.log("Error occur on opening db: " + err);
			writeResponse(resp, { Success: false, Err: "Internal DB Error"});
			return;
		}

		account_db.collection('account', function(err, collection) {
			if (err) {
				console.log("Error occur on open collection: " + err);
				writeResponse(resp, { Success: false, Err: "Internal DB Error(collection)"});
				account_db.close();
				return;
			}

			collection.findOne({ a_id: req.query.a_id }, function(err, data) {
				if (err) {
					console.log("Error occur on query: " + err);
					writeResponse(resp, { Success: false, Err: "Internal DB Error(query)"});
					return;
				}

				account_db.close();
	         	
				if (data) {
					/* Found this account => cannot create again */
					console.log('account: ' + data.a_id + ' existed!');
					writeResponse(resp, { Success: false, Err: "Account existed"});
				} else {
					/* Account not found => can create */
					console.log('Can create account');
					createAccount(req.query, resp);
				}
        	});
		});
	});
}

function createAccount(info, resp) {
	var createRPC = {
		jsonrpc: '2.0',
		method: 'personal_newAccount',
		params: [info.passwd],
		id: 1
	};
	createAccountCmd = spawn('curl', ['-X', 'POST', '--data', JSON.stringify(createRPC), RPC_URL]);

	createAccountCmd.stdout.on('data', function (data) {
		data = JSON.parse(data);
		if (!data.result) {
			console.log('Failed to create account, Err: ' + data.toString());
			writeResponse(resp, { Success: false, Err: "Geth Error When Creating Account" });
		}
		else {
			var address = data.result;
			var new_account = {
				a_id: info.a_id,
				passwd: info.passwd || '',
				address,
				user_ip: '',
				isOnline: false
			};

			account_db.open(function(err, account_db) {
				if (err) {
					console.log("Error occur on opening db: " + err);
					writeResponse(resp, { Success: false, Err: "Internal DB Error"});
					return;
				}

				account_db.collection('account', function(err, collection) {
					if (err) {
						console.log("Error occur on open collection: " + err);
						writeResponse(resp, { Success: false, Err: "Internal DB Error(collection)"});
						account_db.close();
						return;
					}

					collection.insert(new_account, function(err, data) {
						if (err) {
							console.log('Account created but failed to insert, Err: ' + err);
							writeResponse(resp, { Success: false, Err: "Internal DB Error(insert)" });
							account_db.close();
							return;
						} else {
							console.log('Successfully create account: ');
							printInfo(new_account);
							writeResponse(resp, { Success: true });
							account_db.close();
							return;
						}
					});
					
				});
			});
		}
	});

	// createAccountCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + data.toString());
	// });

	// createAccountCmd.on('exit', function (code) {
	// 	console.log('Geth child process exited with code ' + code.toString());
	// });

	// var address = web3.personal.newAccount(info.passwd || '');
}

function onLogin(req, resp){
	if (!req.query.a_id) {
		writeResponse(resp, { Success: false, Err: "a_id not specified."});
		return;
	}

	account_db.open(function(err, account_db) {
		if (err) {
			console.log("Error occur on opening db: " + err);
			writeResponse(resp, { Success: false, Err: "Internal DB Error"});
			return;
		}

		account_db.collection('account', function(err, collection) {
			if (err) {
				console.log("Error occur on open collection: " + err);
				writeResponse(resp, { Success: false, Err: "Internal DB Error(collection)"});
				account_db.close();
				return;
			}

			collection.findOne({ a_id: req.query.a_id }, function(err, data) {
				if (err) {
					console.log("Error occur on query: " + err);
					writeResponse(resp, { Success: false, Err: "Internal DB Error(query)"});
					account_db.close();
					return;
				}
				if (data) {
					/* Found this account => can login */
					req.query.passwd = req.query.passwd || '';
					console.log('Try to login account: ' + data.a_id);
					if (req.query.passwd === data.passwd){
						if(data.isOnline === false){
							loginAccount(req, data, collection, resp);
							console.log('account: ' + data.a_id + ' logged-in');
						}
						else{
							console.log('account: ' + data.a_id + ' has already logged-in');
							writeResponse(resp, { Success: false, Err: "Account has already logged-in"});
						}
					}
					else if(req.query.passwd !== data.passwd){
						console.log('account: ' + data.a_id + ' wrong password');
						writeResponse(resp, { Success: false, Err: "Wrong password"});
					}	
				} 
				else {
					/* Account not found => can' login */
					console.log('Account not found');
					writeResponse(resp, { Success: false, Err: "Account not found(cannot login)"});
				}
				account_db.close();
        	});
		});
	});
}

function loginAccount(info, account_data, collection, resp) {
	var curr_ip = info.headers['x-forwarded-for'] || info.connection.remoteAddress;
	collection.update({a_id: account_data.a_id, isOnline : false, user_ip : ''}, { $set : {isOnline : true, user_ip : curr_ip}
	}, function(err, data) {
		if (err) {
        	console.log('Failed to login, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(update)" });
            return;
        } else {
            console.log('Successfully login, unlocking account...');
			unlockAccount(account_data.address, account_data.passwd);
            writeResponse(resp, { Success: true });
            return;
        }
	});
}

function unlockAccount(address, passwd) {
	var unlockRPC = {
		jsonrpc: '2.0',
		method: 'personal_unlockAccount',
		params: [address, passwd],
		id: 1
	};
	unlockAccountCmd = spawn('curl', ['-X', 'POST', '--data', JSON.stringify(unlockRPC), RPC_URL]);

	unlockAccountCmd.stdout.on('data', function (data) {
		data = JSON.parse(data);
		if (data.result !== true) {
			console.log('Failed to unlock account, Err:' + data.toString());
		}
		else {
			console.log('Successfully unlock account.');
		}
	});

	// unlockAccountCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + data.toString());
	// });

	// unlockAccountCmd.on('exit', function (code) {
	// 	console.log('Geth child process exited with code ' + code.toString());
	// });
}

function lockAccount(account_data) {
	var lockRPC = {
		jsonrpc: '2.0',
		method: 'personal_lockAccount',
		params: [account_data.address],
		id: 1
	};
	lockAccountCmd = spawn('curl', ['-X', 'POST', '--data', JSON.stringify(lockRPC), RPC_URL]);

	lockAccountCmd.stdout.on('data', function (data) {
		data = JSON.parse(data);
		if (data.result !== true) {
			console.log('Failed to lock account, Err:' + data.toString());
		}
		else {
			console.log('Successfully lock account.');
		}
	});

	// lockAccountCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + data.toString());
	// });

	// lockAccountCmd.on('exit', function (code) {
	// 	console.log('Geth child process exited with code ' + code.toString());
	// });
}

function onLogout(req, resp) {
	if (!req.query.a_id) {
		writeResponse(resp, { Success: false, Err: "a_id not specified."});
		return;
	}

	account_db.open(function(err, account_db) {
		if (err) {
			console.log("Error occur on opening db: " + err);
			writeResponse(resp, { Success: false, Err: "Internal DB Error"});
			return;
		}

		account_db.collection('account', function(err, collection) {
			if (err) {
				console.log("Error occur on open collection: " + err);
				writeResponse(resp, { Success: false, Err: "Internal DB Error(collection)"});
				account_db.close();
				return;
			}

			collection.findOne({ a_id: req.query.a_id }, function(err, data) {
				if (err) {
					console.log("Error occur on query: " + err);
					writeResponse(resp, { Success: false, Err: "Internal DB Error(query)"});
					account_db.close();
					return;
				}
				if (data) {
					/* Found this account => can logout */
					var curr_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					console.log('Try to logout account: ' + data.a_id);
					if (curr_ip === data.user_ip){
						if(data.isOnline === true){
							logoutAccount(data, curr_ip, collection, resp);
							console.log('account: ' + data.a_id + ' logged-out');
						}
						else{
							/* Cannot logout */
							console.log('account: ' + data.a_id + ' has not logged-in');
							writeResponse(resp, { Success: false, Err: "Account has not logged-in"});
						}
					}
					else {
						console.log('account: ' + data.a_id + ' wrong user_ip');
						writeResponse(resp, { Success: false, Err: "Wrong user_ip"});
					}
				}
				else {
					/* Account not found => can' logout */
					console.log('Account not found');
					writeResponse(resp, { Success: false, Err: "Account not found(cannot login)"});
				}
				account_db.close();
			});
		});
	});
}

function logoutAccount(account_data, ip, collection, resp){
	collection.update({a_id: account_data.a_id, isOnline : true, user_ip : ip}, { $set : {isOnline : false, user_ip : ''}
	}, function(err, data) {
		if (err) {
        	console.log('Failed to logout, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(update)" });
            return;
        } else {
            console.log('Successfully logout, locking account...');
			lockAccount(account_data);
            writeResponse(resp, { Success: true });
            return;
        }
	});
}

function onChangePasswd(req, resp){
	if (!req.query.a_id) {
		writeResponse(resp, { Success: false, Err: "a_id not specified."});
		return;
	}

	account_db.open(function(err, account_db) {
		if (err) {
			console.log("Error occur on opening db: " + err);
			writeResponse(resp, { Success: false, Err: "Internal DB Error"});
			return;
		}

		account_db.collection('account', function(err, collection) {
			if (err) {
				console.log("Error occur on open collection: " + err);
				writeResponse(resp, { Success: false, Err: "Internal DB Error(collection)"});
				account_db.close();
				return;
			}

			collection.findOne({ a_id: req.query.a_id }, function(err, data) {
				if (err) {
					console.log("Error occur on query: " + err);
					writeResponse(resp, { Success: false, Err: "Internal DB Error(query)"});
					account_db.close();
					return;
				}
				if (data) {
					/* Found this account => can change passwd */
					var curr_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					console.log('Try to change passwd, account: ' + data.a_id);
					if (curr_ip === data.user_ip){
						if(data.isOnline === true){
							changePasswd(req.query, collection, resp, data.passwd);
							console.log('account: ' + data.a_id + ' has changed passwd');
						}
						else{
							/* Cannot change passwd */
							console.log('account: ' + data.a_id + ' has not logged-in');
							writeResponse(resp, { Success: false, Err: "Account has not logged-in"});
						}
					}
					else {
						console.log('account: ' + data.a_id + ' wrong user_ip');
						writeResponse(resp, { Success: false, Err: "Wrong user_ip"});
					}
				}
				else {
					/* Account not found => can' logout */
					console.log('Account not found');
					writeResponse(resp, { Success: false, Err: "Account not found(cannot login)"});
				}
				account_db.close();
        	});
		});
	});
}

function changePasswd(info, collection, resp, oldpasswd){
	collection.update({a_id: info.a_id, passwd: oldpasswd}, { $set : {passwd: info.passwd}
	}, function(err, data) {
		if (err) {
        	console.log('Failed to change passwd, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(update)" });
            return;
        } else {
            console.log('Successfully change passwd');
            writeResponse(resp, { Success: true });
            return;
        }
	});
}

function printInfo(obj) {
	for (var attr in obj) {
		if (obj.hasOwnProperty(attr)) {
			console.log(attr + ": " + obj[attr]);
		}
	}
	console.log('\n');
}

function onCheckBalance(req, resp) {
	if (!req.query.a_id) {
		writeResponse(resp, { Success: false, Err: "a_id not specified."});
		return;
	}

	account_db.open(function(err, account_db) {
		if (err) {
			console.log("Error occur on opening db: " + err);
			writeResponse(resp, { Success: false, Err: "Internal DB Error"});
			return;
		}

		account_db.collection('account', function(err, collection) {
			if (err) {
				console.log("Error occur on open collection: " + err);
				writeResponse(resp, { Success: false, Err: "Internal DB Error(collection)"});
				account_db.close();
				return;
			}

			collection.findOne({ a_id: req.query.a_id }, function(err, data) {
				if (err) {
					console.log("Error occur on query: " + err);
					writeResponse(resp, { Success: false, Err: "Internal DB Error(query)"});
					account_db.close();
					return;
				}
				if (data) {
					/* Found this account => get address */
					console.log('Account: ' + data.a_id + ' found');
					checkCurrentAccountBalance(data.address, resp);
				} 
				else {
					/* Account not found */
					console.log('Account not existed');
					writeResponse(resp, { Success: false, Err: "Account not existed"});
				}
				account_db.close();
        	});
		});
	});
}

function checkCurrentAccountBalance(addr, resp) {
	var balanceWei = web3.eth.getBalance(addr).toNumber();
	var balance = web3.fromWei(balanceWei, 'ether');
	writeResponse(resp, { Success: true, Balance: "" + balance });
	return;
}

console.log('Node-Express server is running at 140.112.18.193:8787 ');
app.get('/create/', onCreate);
app.get('/login/', onLogin);
app.get('/logout/', onLogout);
app.get('/change-passwd/', onChangePasswd);
app.get('/check-balance/', onCheckBalance);
app.listen(8787,'0.0.0.0');
