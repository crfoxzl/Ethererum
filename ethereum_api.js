#!/usr/bin/env nodejs

var Web3 = require('web3');
var mongodb = require('mongodb');
var express = require('express');

var mongodbServer = new mongodb.Server('localhost', 27017, { auto_reconnect: true });
var account_db = new mongodb.Db('account_db', mongodbServer);
var app = express();

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
	var account_info = web3.eth.accounts.new();
	collection.insert({
        a_id: info.a_id,
        passwd: info.passwd || '',
        address: account_info.address,
        publicKey: account_info.publicKey,
        privateKey: account_info.privateKey,
        isOnline: false
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

function onCheckBalance(req, resp) {

}

function checkCurrentAccountBalance(a_id, resp) {
	var balanceWei = web3.eth.getBalance(web3.eth.accounts[0]).toNumber();
	var balance = web3.fromWei(balanceWei, 'ether');
	writeResponse(resp, { Success: true, Balance: "" + balance });
	return;
}

app.get('/create/', onCreate);
app.get('/check-balance/', onCheckBalance);
app.listen(8787,'0.0.0.0');

console.log('Node-Express server is running at 140.112.18.193:8787 ');
