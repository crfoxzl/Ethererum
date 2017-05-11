#!/usr/bin/env nodejs

// TODO:
// (1) V Unlock Account on login
// (2) V Lock Account on logout
// (3) V Transfer
// (4) Admin-logout
// (5) V Auto-logout
// (6) V Init balance: 1000 eth
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
const ADMIN_ADDR = "0xcc0ca8be2b7b6dac72748cc213d611d2f0e5b624";
const ADMIN_PASSWD = "admin";
const ACTIVE_TIME_LIMIT = 5 * 60 * 1000;
const CHECK_ACTIVE_INTERVAL = ACTIVE_TIME_LIMIT / 2;

var mongodbServer = new mongodb.Server('localhost', 27017, { auto_reconnect: true });
var account_db = new mongodb.Db('account_db', mongodbServer);
var app = express();
var startGethCmd;
var createAccountCmd;
var unlockAccountCmd;
var lockAccountCmd;
var checkBalanceCmd;

startGethCmd = spawn('geth', ['--identity', NODE_IDENTITY, '--rpc', '--rpcport', RPC_PORT, '--rpccorsdomain', RPC_DOMAIN, '--datadir', BLOCK_DATA_DIR, '--port', GETH_LISTEN_PORT, '--rpcapi', RPC_API, '--networkid', NETWORK_ID, '--etherbase', ADMIN_ADDR, '--mine']);

// startGethCmd.stdout.on('data', function (data) {
// 	console.log('stdout: ' + JSON.stringify(data.error));
// });

// startGethCmd.stderr.on('data', function (data) {
// 	console.log('stderr: ' + JSON.stringify(data.error));
// });

startGethCmd.on('exit', function (code) {
	console.log('Geth child process exited with code ' + code.toString());
});

var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

function writeResponse(resp, result) {
	if (resp) {
		resp.send("" + JSON.stringify(result));
	}
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
			console.log('Failed to create account, Err: ' + JSON.stringify(data.error));
			writeResponse(resp, { Success: false, Err: "Geth Error When Creating Account" });
		}
		else {
			var address = data.result;
			var new_account = {
				a_id: info.a_id,
				passwd: info.passwd || '',
				address,
				user_ip: '',
				isOnline: false,
				last_active: new Date().getTime()
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
							giveBalance(new_account, 1000);
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
	// 	console.log('stderr: ' + JSON.stringify(data.error));
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
	collection.update({a_id: account_data.a_id, isOnline : false, user_ip : ''}, { $set : {isOnline : true, user_ip : curr_ip, last_active: new Date().getTime()}
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
			console.log('Failed to unlock account, Err:' + JSON.stringify(data.error));
		}
		else {
			console.log('Successfully unlock account.');
		}
	});

	// unlockAccountCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + JSON.stringify(data.error));
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
			console.log('Failed to lock account, Err:' + JSON.stringify(data.error));
		}
		else {
			console.log('Successfully lock account.');
		}
	});

	// lockAccountCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + JSON.stringify(data.error));
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
					if (curr_ip === data.user_ip){
						if(data.isOnline === true){
							logoutAccount(data, collection, resp);
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

function logoutAccount(account_data, collection, resp){
	console.log('Try to logout account: ' + account_data.a_id);
	collection.update({a_id: account_data.a_id, isOnline : true}, { $set : {isOnline : false, user_ip : ''}
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
	collection.update({a_id: info.a_id, passwd: oldpasswd}, { $set : {passwd: info.passwd, last_active: new Date().getTime()}
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
	var chackBalanceRPC = {
		jsonrpc: '2.0',
		method: 'eth_getBalance',
		params: [addr, "latest"],
		id: 1
	};
	checkBalanceCmd = spawn('curl', ['-X', 'POST', '--data', JSON.stringify(chackBalanceRPC), RPC_URL]);

	checkBalanceCmd.stdout.on('data', function (data) {
		data = JSON.parse(data);
		if (!data.result) {
			console.log('Failed to check account balance, Err:' + JSON.stringify(data.error));
			writeResponse(resp, { Success: false, Err: "Geth error on checking balance" });
		}
		else {
			console.log('Successfully get account balance.');
			var balance = web3.fromWei(parseInt(data.result), 'ether');
			writeResponse(resp, { Success: true, Balance: "" + balance });
		}
	});

	// checkBalanceCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + JSON.stringify(data.error));
	// });

	// checkBalanceCmd.on('exit', function (code) {
	// 	console.log('Geth child process exited with code ' + code.toString());
	// });

	return;
}

function onTransfer(req, resp) {
	if (!req.query.a_id) {
		writeResponse(resp, { Success: false, Err: "a_id not specified."});
		return;
	}

	if (!req.query.to_id) {
		writeResponse(resp, { Success: false, Err: "to_id not specified."});
		return;
	}

	if (!req.query.amount) {
		writeResponse(resp, { Success: false, Err: "amount not specified."});
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
					/* Found this account => check ip */
					var curr_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					console.log('Try to transfer from account: ' + data.a_id);
					if (curr_ip === data.user_ip) {
						if (data.isOnline === true) {
							var from_addr = data.address;
							collection.findOne({ a_id: req.query.to_id }, function(err, data) {
								if (err) {
									console.log("Error occur on query: " + err);
									writeResponse(resp, { Success: false, Err: "Internal DB Error(query)"});
									account_db.close();
									return;
								}
								if (data) {
									var to_addr = data.address;
									/* Found this account => can transfer */
									console.log('Try to transfer to account: ' + data.a_id);
									transfer(from_addr, to_addr, req.query.amount, resp);
									console.log('Transfer complete.');
								}
								else {
									/* Account not found => can' transfer */
									console.log('Account not found');
									writeResponse(resp, { Success: false, Err: "Account not found(cannot login)"});
								}
								collection.update({a_id: req.query.a_id}, { $set : {last_active: new Date().getTime()}
									}, function(err, data) {
										if (err) {
											console.log('Failed to update last_active, Err: ' + err);
											return;
										} else {
											console.log('Successfully update last_active');
											return;
										}
									});
								account_db.close();
								return;
							});
						}
						else {
							/* Cannot transfer */
							console.log('account: ' + data.a_id + ' has not logged-in');
							writeResponse(resp, { Success: false, Err: "Account has not logged-in"});
							account_db.close();
							return;
						}
					}
					else {
						console.log('account: ' + data.a_id + ' wrong user_ip');
						writeResponse(resp, { Success: false, Err: "Wrong user_ip"});
						account_db.close();
						return;
					}
				}
				else {
					/* Account not found => can' transfer */
					console.log('Account not found');
					writeResponse(resp, { Success: false, Err: "Account not found(cannot login)"});
					account_db.close();
					return;
				}
        	});
		});
	});
}

function transfer(from_addr, to_addr, amount, resp) {
	var transferRPC = {
		jsonrpc: '2.0',
		method: 'eth_sendTransaction',
		params: [{
			from: from_addr,
			to: to_addr,
			value: web3.fromDecimal(web3.toWei(parseFloat(amount), "ether"))
		}],
		id: 1
	};
	transferCmd = spawn('curl', ['-X', 'POST', '--data', JSON.stringify(transferRPC), RPC_URL]);

	transferCmd.stdout.on('data', function (data) {
		data = JSON.parse(data);
		if (!data.result) {
			console.log('Failed to transfer, Err:' + JSON.stringify(data.error));
			if (data.error.code === -32000) {
				writeResponse(resp, { Success: false, Err: "Cannot transfer such large amount" });
			}
			else {
				writeResponse(resp, { Success: false, Err: "Geth error on transfer" });
			}
		}
		else {
			console.log('Successfully transfer.');
			writeResponse(resp, { Success: true, Hash: "" + data.result });
		}
	});

	// transferCmd.stderr.on('data', function (data) {
	// 	console.log('stderr: ' + JSON.stringify(data.error));
	// });

	// transferCmd.on('exit', function (code) {
	// 	console.log('Geth child process exited with code ' + code.toString());
	// });

	return;
}

function giveBalance(account, amount) {
	unlockAccount(ADMIN_ADDR, ADMIN_PASSWD);
	transfer(ADMIN_ADDR, account.address, amount);
	lockAccount(ADMIN_ADDR);
}

function autoLogout() {
	console.log("Auto logout...");
	account_db.open(function(err, account_db) {
		if (err) {
			console.log("Error occur on opening db: " + err);
			return;
		}

		account_db.collection('account', function(err, collection) {
			if (err) {
				console.log("Error occur on open collection: " + err);
				account_db.close();
				return;
			}

			var timeLimit = new Date().getTime() - ACTIVE_TIME_LIMIT;
			collection.find({ isOnline: true, last_active: { $lt: timeLimit } }).toArray(function(err, data) {
				if (err) {
					console.log("Error occur on query: " + err);
					account_db.close();
					return;
				}
				if (data) {
					/* Found expired account => logout */
					data.forEach((account) => {
						logoutAccount(account, collection);
					});
				}
				else {
					/* Account not found */
					console.log('No expired account');
				}
				account_db.close();
        	});
		});
	});
}

console.log('Node-Express server is running at 140.112.18.193:8787 ');
app.get('/create/', onCreate);
app.get('/login/', onLogin);
app.get('/logout/', onLogout);
app.get('/change-passwd/', onChangePasswd);
app.get('/check-balance/', onCheckBalance);
app.get('/transfer/', onTransfer);
app.listen(8787,'0.0.0.0');

setInterval(function () {
	autoLogout();
}, CHECK_ACTIVE_INTERVAL);