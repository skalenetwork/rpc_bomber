const jrpc=require("json-rpc-2.0");
const fetch=require("node-fetch");
const fs = require('fs');
const Web3 = require('web3');

const http = require("http");
//const axios=require("axios").default;

const { ArgumentParser } = require('argparse');

const keys_file='keys.json';

let url;
let client;	// json-rpc client
let web3, chainId;
let acc_count;
let acc_from;
let sockets;
let data_size;
let time_limit=Infinity;

let BN = 1;		// for bomb_requests
let batch;
let bomb_request_name;	// eth_getBlock or web3_clientVersion

let agent;		// for fetch

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

/*
const api = axios.create({
  	httpAgent: agent,
  	method: "post",
  	timeout: 60000,
    headers: {
      	"content-type": "application/json"
    }
});

function fetcher_axios(jsonRPCRequest){
	// should send request immediately
	// on receive push result to client
	// and for some strange reason return it to http-client
	
//	console.log("Req:");
//	console.log(jsonRPCRequest);
	
	return api.request({
	  	baseURL: url,
		data: JSON.stringify(jsonRPCRequest)
	}).then((result)=>{
//		console.log("Res:");
//		console.log(result);
		client.receive(result.data);
	}).catch((error)=>{
		return Promise.reject(new Error(error.message));
	});
}
*/

function fetcher_fetch(jsonRPCRequest){
  //console.log(jsonRPCRequest);
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    'agent': agent,
    body: JSON.stringify(jsonRPCRequest),
  }).then((response) => {
    if (response.status === 200) {
      // Use client.receive when you received a JSON-RPC response.
      return response
        .json()
        .then((jsonRPCResponse) => client.receive(jsonRPCResponse));
    } else if (jsonRPCRequest.id !== undefined) {
      return Promise.reject(new Error(response.statusText));
    }
  });
}

client = new jrpc.JSONRPCClient(fetcher_fetch);

async function bomb_transactions(){

    console.log("Bombing with batches of " + acc_count + " transactions"); 

	console.log("Loading private keys from " + keys_file);
	const keys = JSON.parse(fs.readFileSync(keys_file, 'utf8'));
	
	console.log("Converting  private keys");
	
	const accounts = [];
	for(let i=0; i<acc_count; ++i)// in keys)
	    	accounts.push( web3.eth.accounts.privateKeyToAccount( keys[i+acc_from] ) );
	console.log("OK");

	console.log("Preparing " + data_size + " transaction data");
	let data = "0x";
	for(let i=0; i<keys.length; ++i){
		if((data.length-2)/2 >= data_size)
			break;
		data += keys[i].substr(2);
	}
	console.log("Data length " + (data.length-2)/2 + " OK");

	let nonces = [];
	let incr=[];

	var all_counter = 0, all_success_counter = 0;
	var success_counter = 0, error_counter = 0, hangup_counter=0, timeout_counter=0, reset_counter=0,notavail_counter=0,nonce_counter=0;
	nonces = accounts.map(()=>{return 0;});
	incr = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
	let error_time_acc = 0;
	
	let t1 = Date.now();
	
    function stats(){
        if( all_counter % 1000 == 0){
            var dt = Date.now() - t1;
            console.log( Math.trunc(all_counter/1000) + "k attempts "
                       + all_success_counter/1000 + "k success "
                       + "\n\t" + Math.trunc(success_counter*1000/dt) + " tx/s "
                       + "\n\t" + Math.trunc(error_counter*1000/dt) + " err/s "
                       + "\n\t" + Math.trunc(timeout_counter*1000/dt) + " timeout/s "
                       + "\n\t" + Math.trunc(reset_counter*1000/dt) + " ECONNRESET/s "
                       + "\n\t" + Math.trunc(hangup_counter*1000/dt) + " hang up/s "
                       + "\n\t" + Math.trunc(notavail_counter*1000/dt) + " EADDRNOTAVAIL/s "
                       + "\n\t" + nonce_counter + " total nonce inc "
                       + "\n\t" + error_time_acc/1000/error_counter + " s avg error time"
                       );
            //console.log(incr);
            success_counter = 0; error_counter = 0; hangup_counter=0; timeout_counter=0; reset_counter=0; notavail_counter=0;
            error_time_acc = 0;
            t1 = Date.now();
        }
    }
	
	async function submit(i){
	    
	    let start_time = Date.now();

	    while(true){

		tr = {
			'nonce': web3.utils.toHex( nonces[i] ),
			'chainId': chainId,
			'to': accounts[i]['address'],
			'value': '0',
			'gas': 21000+(data.length-2)*2*17,	// strange!?
			'gasPrice': '100000',
			'data': data
		};
		//console.log(tr);
		signed  = await web3.eth.accounts.signTransaction( tr, accounts[i].privateKey );

		try{
            await client.timeout(60000).request("eth_sendRawTransaction", [signed.rawTransaction]);
            all_counter++;
            success_counter++;
            all_success_counter++;
            incr[nonces[i]]++;
            ++nonces[i];
            stats();

            //return;
        }catch(ex){
        	    all_counter++;
                error_counter++;
                
                error_time_acc += Date.now() - start_time;
                
                //console.log(ex.message);
                
				if(ex.message.includes("same nonce")){
					await sleep(1000+i*10);
				}
                else if(ex.message.includes("nonce")){
                    while(true){
                        try{
                            nonces[i] = +await web3.eth.getTransactionCount(accounts[i].address);
                            nonce_counter++;
                            break;
                        }catch(ex){

                        }// catch
                    }// while
                }
                else if(ex.message.includes("Same transaction")){
                    await sleep(1000+i*10);
				}
                else if(ex.message.includes("timeout")){
                    timeout_counter++;
                }
                else if(ex.message.includes("hang up")){
                    hangup_counter++;
                    await sleep(1000+i*10);
                }
                else if(ex.message.includes("ECONNRESET")){
                    reset_counter++;
                    await sleep(1000+i*10);
                }
                else if(ex.message.includes("EADDRNOTAVAIL")){
                    notavail_counter++;
                    await sleep(1000+i*10);
                }
                else {
                    console.log(ex.message + " In account " + i + " retrying.");
                }
                
                stats();
                //submit(i);
				//break;
		}

		if(Date.now()-start_time>=time_limit*1000){
			console.log("Time limit reached, exiting");
			break;
		}

		}//while
	}
	
	promises = []
	for(var i in accounts){
		await sleep(1);
    	promises.push(submit(i));
    }

    await Promise.all(promises);
}

async function bomb_requests(){

    console.log("Bombing with " + bomb_request_name + " requests in batches of " + batch);
	let time_start = Date.now();

	var i = 0;
	var error;
	var in_progress = 0;    // track buffer size

    function eth_request(){
		if(bomb_request_name=="eth_getBlock")
			return web3.eth.getBlock(Math.ceil(Math.random()*BN), true);
		else if(bomb_request_name=='web3_clientVersion')
			return web3.eth.getNodeInfo();
		else assert(false);
	}

	while(true){
		for(var j=0; j<batch; ++j){
		    
		    while(in_progress > 2*batch){
		        console.log("\t"+in_progress + " requests in progress, waiting 1 sec");
		        await sleep(1000);
		    }
		    
			eth_request().then(function(res){
				--in_progress;
			}).catch(function(ex){
				if(!error)
				    console.log(ex.message);
				error = true;
				--in_progress;
			});
			++in_progress;
		}// for
		++i;
	
		console.log(i+" batches");
		web3.eth.getBlockNumber().then(function(b){BN=b;}).catch(function(){});
	
		if(error){
			console.log("Exception: waiting 1 sec");
			await sleep(1000);
		}

		if(Date.now()-time_start>=time_limit*1000)
			break;
	}// while
}

async function main(){
	
	const parser = new ArgumentParser({
	  	description: 'Ethereum JSON-RPC bomber'
	});

	let rt_group = parser.add_mutually_exclusive_group();
	rt_group.add_argument('-r', {help: "bomb endpoint with eth_getBlock requests", action: 'store_true'});
	rt_group.add_argument('-t', {help: "bomb endpoint with transactions", action: 'store_true'});
	rt_group.add_argument('-l', {help: "bomb endpoint with light requests: web3_clientVersion", action: 'store_true'});
	parser.add_argument('-a', '--accounts', {help: "number of accounts to use (<=24000)", default:1000});
	parser.add_argument('--from', {help: "starting account number (<24000)", default:0});
	parser.add_argument('-d', {help: "transaction payload data size in bytes(<=768000)", default:0});
	parser.add_argument('-b', '--batch', {help: "number of requests executed in parallel (-r only)", default:1000});
	parser.add_argument('-s', '--sockets', {help: "number of keepalive-sockets", default:1000000});
	parser.add_argument('--time', {help: "How many seconds to run", default:Infinity});
	parser.add_argument('url', {help: "endpoint URL to connect to (http://ip:port)"});

	let args=parser.parse_args();

	sockets = +args.sockets;
	console.log("Using maximum " + sockets + " sockets");

	time_limit = +args.time;

	agent = new http.Agent({
		    	keepAlive: true,
    			maxSockets: sockets
			});

    url = args.url;
	console.log("Connecting to " + url);
	let bn = await client.request("eth_blockNumber", []);
	console.log("Block = " + bn);
	
	acc_count = +args.accounts;
		
	acc_from = +args.from;

	data_size = +args.d;

	batch = +args.batch;

	let provider_options = {
	    timeout: 60000, // ms

		agent: {
			http: agent,
			baseUrl: url
		}
	};

	console.log("Initializing web3");
	web3 = new Web3(new Web3.providers.HttpProvider('/', provider_options));

	bn = await web3.eth.getBlock("latest", true);
	bn = bn.number;
	console.log("Block from web3 = " + bn);
	BN=bn;
	
	chainId = await web3.eth.getChainId();
	console.log("chainId = " + chainId);
	
	if(args.r){
		bomb_request_name="eth_getBlock";
		await bomb_requests();
	}
	else if(args.l){
		bomb_request_name="web3_clientVersion";
		await bomb_requests();
	}
	else if(args.t){
		await bomb_transactions();
	}
	else{
		console.log("ERROR: need to specify either -r or -t");
		parser.print_usage();
	}
	
}

main();
