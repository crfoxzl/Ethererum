#!/usr/bin/env nodejs

// var http = require('http');
var Web3 = require('web3');
var mongodb = require('mongodb');
var express = require('express');

var mongodbServer = new mongodb.Server('localhost', 27017, { auto_reconnect: true });
var account_db = new mongodb.Db('account_db', mongodbServer);
var app = express();

var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

var handleRequest = function(req, resp) {
	var parts = url.parse(req.url, true);
	var query = parts.query;

	switch(query.method) {
	case 'create':
		createAccount(query.a_id, query.passwd, resp);
		break;
	case 'login':
		loginAccount(query.a_id, query.passwd);
		break;
	case 'logout':
		logoutCurrentAccount();
		break;
	case 'transfer':
		transferTo(query.recv_id, query.amount);
		break;
	case 'checkBalance':
		checkCurrentAccountBalance(query.a_id, resp);
		break;
	default:
		writeResponse(resp, { Success: false, Err : "Wrong Query" });
		break;
	}

	// resp.writeHead(200, {'Content-Type': 'text/plain'});
	// resp.end("" + JSON.stringify(result));
}

//ip:8787/create/?a_id=abc&passwd=aa

// 	function(req, res){
//   res.send('id: ' + req.query.id);
// });

// var server = http.createServer(handleRequest);

// server.listen(8787,'0.0.0.0',function(){
//     console.log('Server is running on http://140.112.18.193:8787/');
// });

function writeResponse(resp, result) {
	// resp.writeHead(200, {'Content-Type': 'text/plain'});
	// resp.end("" + JSON.stringify(result));
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
	collection.insert({
        a_id: info.a_id,
        passwd: info.passwd || '',
		isOnline: true,
    }, function(err, data) {
        if (err) {
        	console.log('Failed to create account, Err: ' + err);
            writeResponse(resp, { Success: false, Err: "Internal DB Error(insert)" });
            return;
        } else {
            console.log('Successfully create account');
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
					/* Found this account => cannot create again */
					console.log('account: ' + data.a_id + ' existed');
					if (req.query.passwd === data.passwd){
						if(data.isOnline === false){
							console.log('account: ' + data.a_id + ' logged-in');
							loginAccount(req.query, collection, resp);
						}
						else{
							console.log('account: ' + data.a_id + ' has already logged-in');
							writeResponse(resp, { Success: false, Err: "Account has already logged-in"});
						}
					}
					else if(req.query.passwd !== data.passwd){
						console.log('account: ' + ' wrong password');
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
	collection.update({'isOnline' : false}, { $set : {'isOnline' : true}
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

function logoutCurrentAccount(){
	?
}

function checkCurrentAccountBalance(a_id, resp) {
	var balanceWei = web3.eth.getBalance(web3.eth.accounts[0]).toNumber();
	var balance = web3.fromWei(balanceWei, 'ether');
	writeResponse(resp, { Success: true, Balance: "" + balance });
	return;
}

app.get('/create/', onCreate);
app.get('/login/', onLogin);
app.listen(8787,'0.0.0.0');
// var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
// web3.eth.getAccounts(console.log);

// var balanceWei = web3.eth.getBalance(web3.eth.accounts[0]).toNumber();
// var balance = web3.fromWei(balanceWei, 'ether');
// console.log("balance: " + balance);

// var mining = web3.eth.mining;

// console.log(mining);
// var balance = web3.eth.getBalance(coinbase);

// console.log(web3.version.api);

/* open db */
// account_db.open(function(err, account_db) {
// 	if (err) {
// 		console.log("Error occur on open db: " + err);
// 	}
//     /* Select 'account' collection */
// 	// account_db.collection('account', function(err, collection) {
//         /* Insert a data */
//     //    collection.insert({
//     //        a_id: 'tom6311tom6311',
//     //        passwd: 'qa1968qa'
//     //    }, function(err, data) {
//     //        if (data) {
//     //            console.log('Successfully Insert');
//     //        } else {
//     //            console.log('Failed to Insert, Err: ' + err);
//     //        }
//     //    });
// 	// });

// 	account_db.collection('account', function(err, collection) {
//         /* Querying */
//         collection.findOne({ a_id: 'tom6311tom6311' }, function(err, data) {
//             /* Found this People */
//             if (data) {
// 				// console.log(data);
//                 console.log('account: ' + data.a_id + ', password: ' + data.passwd);
//             } else {
//                 console.log('Cannot found');
//             }
//         });
//     });
// });
