#!/usr/bin/env nodejs

var Web3 = require('web3');
var mongodb = require('mongodb');
var express = require('express');
var exec = require('child_process').exec;

var mongodbServer = new mongodb.Server('localhost', 27017, { auto_reconnect: true });
var account_db = new mongodb.Db('account_db', mongodbServer);
var app = express();

executeCommand('geth --identity "Node01" --rpc --rpcport "8545" --rpccorsdomain "*" --datadir "/home/pc193/ethereum/chain1/" --port "30303" --rpcapi "db,eth,net,web3,personal" --networkid 196876');

var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// var handleRequest = function(req, resp) {
// 	var parts = url.parse(req.url, true);
// 	var query = parts.query;

// 	switch(query.method) {
// 	case 'create':
// 		createAccount(query.a_id, query.passwd, resp);
// 		break;
// 	case 'login':
// 		loginAccount(query.a_id, query.passwd);
// 		break;
// 	case 'logout':
// 		logoutCurrentAccount();
// 		break;
// 	case 'transfer':
// 		transferTo(query.recv_id, query.amount);
// 		break;
// 	case 'checkBalance':
// 		checkCurrentAccountBalance(query.a_id, resp);
// 		break;
// 	default:
// 		writeResponse(resp, { Success: false, Err : "Wrong Query" });
// 		break;
// 	}
// }

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
					account_db.close();
					return;
				}
	         	
				if (data) {
					/* Found this account => cannot create again */
					console.log('account: ' + data.a_id + ' existed!');
					writeResponse(resp, { Success: false, Err: "Account existed"});
				} else {
					/* Account not found => can create */
					console.log('Can create account');
					createAccount(req.query, collection, resp);
				}
				account_db.close();
        	});
		});
	});
}

function createAccount(info, collection, resp) {
	var account_info = web3.personal.newAccount(info.passwd || '');
	var new_account = {
        a_id: info.a_id,
        passwd: info.passwd || '',
        address: account_info.address,
		user_ip: '',
        publicKey: account_info.publicKey,
        privateKey: account_info.privateKey,
        isOnline: false
    };

	collection.insert(new_account, function(err, data) {
        if (err) {
        	console.log('Failed to create account, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(insert)" });
            return;
        } else {
            console.log('Successfully create account: ');
            printInfo(new_account);
            writeResponse(resp, { Success: true });
            return;
        }
    });
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
							loginAccount(req, collection, resp);
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

function loginAccount(info, collection, resp){
	var ip = info.headers['x-forwarded-for'] || info.connection.remoteAddress;
	collection.update({isOnline : false, user_ip : ''}, { $set : {isOnline : true, user_ip : ip}
	}, function(err, data) {
		if (err) {
        	console.log('Failed to login, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(update)" });
            return;
        } else {
            console.log('Successfully login');
            writeResponse(resp, { Success: true });
            return;
        }
	});
}

function onLogout(req, resp){
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
					var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					console.log('Try to logout account: ' + data.a_id);
					if (ip === data.user_ip){
						if(data.isOnline === true){
							logoutAccount(ip, collection, resp);
							console.log('account: ' + data.a_id + ' logged-out');
						}
						else{
							/* Cannot logout */
							console.log('account: ' + data.a_id + ' has not logged-in');
							writeResponse(resp, { Success: false, Err: "Account has not logged-in"});
						}
					}
					else if(ip !== data.user_ip){
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

function logoutAccount(ip, collection, resp){
	collection.update({isOnline : true, user_ip : ip}, { $set : {isOnline : false, user_ip : ''}
	}, function(err, data) {
		if (err) {
        	console.log('Failed to logout, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(update)" });
            return;
        } else {
            console.log('Successfully logout');
            writeResponse(resp, { Success: true });
            return;
        }
	});
}

function onChange_passwd(req, resp){
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
					/* Found this account => can change_passwd */
					var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					console.log('Try to change_passwd, account: ' + data.a_id);
					if (ip === data.user_ip){
						if(data.isOnline === true){
							change_passwd(req.query, collection, resp, data.passwd);
							console.log('account: ' + data.a_id + ' has changed passwd');
						}
						else{
							/* Cannot change passwd */
							console.log('account: ' + data.a_id + ' has not logged-in');
							writeResponse(resp, { Success: false, Err: "Account has not logged-in"});
						}
					}
					else if(ip !== data.user_ip){
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

function change_passwd(info, collection, resp, oldpasswd){
	collection.update({passwd: oldpasswd}, { $set : {passwd: info.passwd}
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

function executeCommand(cmd) {
	exec(cmd, function (err, stdout, stderr) {
		if (err) {
			console.error('Error while executing native command: ' + cmd + '\n msg: ' + err);
			return;
		}
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
	})
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
	
}

function checkCurrentAccountBalance(a_id, resp) {
	var balanceWei = web3.eth.getBalance(web3.eth.accounts[0]).toNumber();
	var balance = web3.fromWei(balanceWei, 'ether');
	writeResponse(resp, { Success: true, Balance: "" + balance });
	return;
}

app.get('/create/', onCreate);
app.get('/login/', onLogin);
app.get('/check-balance/', onCheckBalance);
app.get('/logout/', onLogout);
app.get('/change_passwd/', onChange_passwd);
app.listen(8787,'0.0.0.0');

console.log('Node-Express server is running at 140.112.18.193:8787 ');
