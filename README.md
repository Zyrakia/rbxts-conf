# Ping

Yet another super simple bindable event wrapper which uses ✨`camelCase`✨ and allows connection directly or via an encapsulated `connector`, which is useful for replicating the behaviour of regular Roblox signals.

## Example

A simple example, there isn't much to this library.

```ts
class PingExample {
	// Both of these work!
	private ping = new Ping<(player: Player) => void>();
	private ping = new Ping<[player: Player]>();

	// Open up the API to connect to the ping externally
	public readonly onPing = this.ping.connector;

	private foo(player: Player) {
		// Alerts all connections
		this.ping.fire(player);
	}
}

const example = new PingExample();

// To any external users, only .connect, .connectParallel and .wait are available.
example.onPing.connect((player) => {
	print(player);
});
```
