# Ethereum JSON-RPC bomber

A tool to send load to Etheraum JSON-RPC endpoint

```
usage: rpc_bomber.js [-h] [-r | -t] [-a ACCOUNTS] [--from FROM] [-b BATCH] [-s SOCKETS] url

positional arguments:
  url                   endpoint URL to connect to (http://ip:port)

optional arguments:
  -h, --help            show this help message and exit
  -r                    bomb endpoint with getBlock requests
  -t                    bomb endpoint with transactions
  -a ACCOUNTS, --accounts ACCOUNTS
                        number of accounts to use (<=24000)
  --from FROM           starting account number (<24000)
  -b BATCH, --batch BATCH
                        number of getBlock requests executed in parallel
  -s SOCKETS, --sockets SOCKETS
                        number of keepalive-sockets
```

## Examples

```
# Create 1000 keep-alive connections to local Ethereum client and repeatedly bomb it with batches of 1000 requests
node rpc_bomber.js -r -b 1000 -s 1000 http://127.0.0.1:8545

# Create 10000 keep-alive connections to local Ethereum client and send transactions to it in batches of 10000,
# retry transaction in case of error
node rpc_bomber.js -t -a 10000 -s 10000 http://127.0.0.1:8545

# Run two instaces of bomer, using accounts 0-999 and 1000-1999 respectively,
# do not limit number of connections
node rpc_bomber.js -t -a 1000 --from 0 http://127.0.0.1:8545&
node rpc_bomber.js -t -a 1000 --from 1000 http://127.0.0.1:8545&
```
