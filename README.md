# Ethererum

JSON-RPC wallet API for ethererum control

Method 1.: create
	Request: HTTP GET
		params:
			<param>	<type>
			a_id	string
			passwd	string
		format:
			/create/?a_id=<>&passwd=<>
	Response:
		Success:
			{
				jsonrpc: '2.0',
				id: 1,
				{
					"Success": true,
					"Hash",
				}
			}
		Failure: depend on conditions. (Err, Wrong user, etc.)

Method 2.: login
	Request: HTTP GET
		params:
			<param>	<type>
			a_id	string
			passwd	string
		format:
			/login/?a_id=<>&passwd=<>
	Response:
		Success:
			{
				"jsonrpc": '2.0',
				"id": 1,
				{
					"Success": true,
					"LoginID",
					"Hash",
				}
			}
		Failure: depend on conditions. (Err, Wrong user, etc.)
		
Method 3.: logout
	Request: HTTP GET
		params:
			<param>	<type>
			a_id	string
			hash	string
		format:
			/logout/?a_id=<>&hash=<>
	Response:
		Success:
			{
				"jsonrpc": '2.0',
				"id": 1,
				{
					"Success": true,
					"LogoutID",
				}
			}
		Failure: depend on conditions. (Err, Wrong user, etc.)

Method 4.: transfer
	Request: HTTP GET
		params:
			<param>	<type>
			a_id	string
			to_id	string
			amount	double
			hash	string
		format:
			/transfer/?a_id=<>&to_id=<>&amount=<>&hash=<>
	Response:
		Success:
			{
				"jsonrpc": '2.0',
				"id": 1,
				{
					"Success": true,
					"TransactionID",
				}
			}
		Failure: depend on conditions. (Err, Wrong user, etc.)

Method 5.: check-balance
	Request: HTTP GET
		params:
			<param>	<type>
			a_id	string
		format:
			/check-balance/?a_id=<>
	Response:
		Success:
			{
				"jsonrpc": '2.0',
				"id": 1,
				{
					"Success": true,
					"Balance",
				}
			}
		Failure: depend on conditions. (Err, Wrong user, etc.)
		
Method 6.: change-passwd
	Request: HTTP GET
		params:
			<param>	<type>
			a_id	string
			passwd	string
			hash	string
		format:
			/change-passwd/?a_id=<>&passwd=<>&hash=<>
	Response:
		Success:
			{
				"jsonrpc": '2.0',
				"id": 1,
				{
					"Success": true,
				}
			}
		Failure: depend on conditions. (Err, Wrong user, etc.)