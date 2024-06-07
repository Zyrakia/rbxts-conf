<div align="center">
    <h1>Conf</h1>
</div>

Conf is a simple module to get and set variables from a Roblox `Configuration` instance.

## Why Conf?

Conf combines keys and types to allow multiple `ValueBase` instances to exist under the same name, if they hold separate types.

This means that the following code:

```ts
conf.set('apples', true);
conf.set('apples', 10);
```

will result in the following Roblox tree:

```md
Configuration
├── BoolValue "apples": true
└── NumberValue "apples": 10
```

These can be written to and read from individually, but they will
both be deleted together with:

```ts
conf.delete('apples');
```

## Introduction

#### **Existing Values**

In Conf, each `ValueBase` instance is referred to as a `"Store"`. At instantiation, all existing stores are registered, meaning a reference of them is saved into the Conf instance.

Existing stores can be addressed via their instance name, which becomes their key. New stores are created when a new key is written to.

Any changes in the Roblox tree after instantiation are not automatically reflected, but this can be enabled with.

```ts
conf.watchTree();
```

#### **Obtaining Values**

When obtaining values in Conf, you must specify what you are expecting.

This is important to maintain type safety and keys associated with values of multiple types.

```ts
conf.get('apples', 'number');
```

If you would like to prevent the `undefined` result, in the case of the value not existing, you can use the `ensure` method.

```ts
conf.ensure('apples', 5);
```

In this case, Conf infers what type of value you are trying to obtain, and will address the correct store. If no store exists, or the store holds no value (in case of `ObjectValue`), the fallback will be returned. When using the fallback value, no store is created.

#### **Setting Values**

When setting values in Conf, the type of value you are setting is automatically
inferred, and the appropriate store is created, if it does not exist already.

```ts
conf.set('apples', 10); // NumberValue store is created, if it doesn't exist
conf.set('apples', true); // BoolValue store is created, if it doesn't exist
```

#### **Deleting Values**

When deleting values, the key itself is deleted. This means that if multiple stores exist under the same key, they are all deleted.

```ts
conf.set('apples', 10);
conf.set('apples', true);

conf.delete('apples'); // Deletes both the Numbervalue and BoolValue store
```

#### **Instance Tree Synchronization**

Automatic synchronization can be enabled with:

```ts
conf.watchTree();
```

and disabled with:

```ts
conf.ignoreTree();
```

Manual synchronization can be executed with:

```ts
conf.syncTree();
```

Automatic sync does not reflect name changes of stores after they have
been added. This means that if a store instance changes it's name, it's key within Conf will still be the original name.

This issue persists until a manual sync is executed, because a manual sync will re-register all stores.
