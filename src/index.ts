/**
 * Utility type to turn a Typescript
 * inferred type into it's primitive.
 *
 * Example: `ToPrimitive<"abc"> = string`
 */
type ToPrimitive<T> = T extends Instance
	? Instance
	: T extends BrickColor
	? BrickColor
	: T extends number
	? number
	: T extends bigint
	? bigint
	: T extends string
	? string
	: T extends boolean
	? boolean
	: T extends symbol
	? symbol
	: T extends null
	? null
	: T extends undefined
	? undefined
	: never;

//                        //
// *** Root Map Types *** //
//                        //

/** Maps the name of a store to the instance type of the store. */
type StoreNameToStore = ExtractMembers<CreatableInstances, ValueBase>;
/** Maps the store name to the type of value that the store holds. */
type StoreNameToType = { [K in keyof StoreNameToStore]: StoreNameToStore[K]['Value'] };
/** Maps the name of type to the instance type of the store that holds it. */
type TypeNameToStore = {
	[K in keyof StoreNameToStore as ExtractKeys<CheckableTypes, StoreNameToType[K]>]: StoreNameToStore[K];
};

//                                     //
// *** Dervied from Root Map Types *** //
//                                     //

/** Maps the name of a store to the name of the type that the store holds. */
type StoreNameToTypeName = { [K in keyof StoreNameToType]: ExtractKeys<CheckableTypes, StoreNameToType[K]> };
/** Maps the name of a type to the name of the store that holds it. */
type TypeNameToStoreName = { [K in keyof StoreNameToStore as StoreNameToTypeName[K]]: K };
/** Maps the name of a type to the actual type that is represents by it. */
type TypeNameToType = { [K in keyof TypeNameToStore]: TypeNameToStore[K]['Value'] };
/** Represents all types that have a store associated with it. */
type AllowedTypes = StoreNameToType[keyof StoreNameToType];
/** Represents all type names that have a store associated with it. */
type AllowedTypeNames = keyof TypeNameToStore;

/**
 * Physical record to map the type name to the
 * class name of the store that holds it.
 *
 * Enforced by {@link TypeNameToStoreName}.
 */
const TypeNameToStoreClass: TypeNameToStoreName = {
	boolean: 'BoolValue',
	BrickColor: 'BrickColorValue',
	CFrame: 'CFrameValue',
	Color3: 'Color3Value',
	Instance: 'ObjectValue',
	nil: 'ObjectValue',
	number: 'NumberValue',
	Ray: 'RayValue',
	string: 'StringValue',
	vector: 'Vector3Value',
	Vector3: 'Vector3Value',
};

/**
 * Wrapper around a Roblox {@link Configuration} instance to easily
 * read and write to values stored under it.
 */
export class Conf {
	/**
	 * The seperator used to generated
	 * typed keys for store registration.
	 */
	private static TYPED_KEY_SEP = ':__conf:';

	/**
	 * A reference of all registered stores.
	 *
	 * Stores are registered with a typed key that
	 * ensures there can be multiple stores with
	 * the same name but that carry different types.
	 *
	 * @see {@link Conf.TYPED_KEY_SEP}
	 * @see {@link Conf.getTypedKey}
	 * @see {@link Conf.getUntypedKey}
	 */
	private stores = new Map<string, ValueBase>();

	/**
	 * Creates a new Conf.
	 *
	 * Construction ___can___ be based off of an existing instance,
	 * in which case it will register all existing
	 * values that exist under the instance.
	 *
	 * @param inst the existing, optional, configuration instance
	 */
	public constructor(private inst = new Instance('Configuration')) {
		inst.GetChildren().forEach((v) => {
			if (!v.IsA('ValueBase')) return;
			this.registerExistingStore(v);
		});
	}

	/**
	 * Obtains the value at the specified key that is of the specified type.
	 *
	 * If there is no value for the given key, nothing will be returned.
	 *
	 * @param key the key to get
	 * @param typeName the type of value that is expected
	 * @returns the value at the key, or nothing
	 */
	public get<T extends Exclude<AllowedTypeNames, 'nil'>>(key: string, typeName: T) {
		const store = this.getStore(key, typeName);
		if (!store) return;

		// I am not sure why this assertion is required :()
		// The narrowed type of `store` somehow is lost the second we access `Value`
		return store.Value as (typeof store)['Value'];
	}

	/**
	 * Sets the value at the specified key.
	 * If a key is set that does not exist already, a value
	 * will be created for it, otherwise it will be overwritten.
	 *
	 * The type of value is inferred from the value that is being
	 * set. If `undefined` is passed, it is inferred that an instance
	 * value is being set, because that is the only value that can
	 * hold `undefined`.
	 *
	 * @param key the key to set
	 * @param value the value to set at the key
	 */
	public set<T extends AllowedTypes>(key: string, value: T) {
		const typeName = Conf.getTypeName(value);
		if (!typeName) throw `Unsupported type provided while setting "${key}": "${typeName}".`;

		const store = this.ensureStore(key, typeName);
		store.Value = value;
	}

	/**
	 * Deletes the value (and so, the value instance) at the
	 * specified key.
	 *
	 * If there are multiple types of values with the specified
	 * key, they will all be deleted.
	 *
	 * @param key the key to delete
	 */
	public delete(key: string) {
		const matchingKeys = [];
		for (const [typedKey, store] of this.stores) {
			const untypedKey = Conf.getUntypedKey(typedKey);
			if (untypedKey === key) matchingKeys.push([typedKey, store] as const);
		}

		for (const [key, store] of matchingKeys) {
			this.stores.delete(key);
			store.Destroy();
		}
	}

	/**
	 * Obtains the value at the specified key, falling back
	 * to the specified value if no value exists at the key.
	 *
	 * The type of value that is being retrieved is inferred from
	 * the type of the fallback value.
	 *
	 * @param key the key to get
	 * @param fallback the fallback value
	 * @returns the value at the key, or the fallback value if there is no value at the key
	 */
	public ensure<T extends AllowedTypes>(key: string, fallback: T) {
		const typeName = Conf.getTypeName(fallback);
		if (!typeName) throw `Unsupported value provided on ensure: "${typeName}".`;

		const store = this.getStore(key, typeName);
		if (!store) return fallback;

		const savedValue = store.Value as (typeof store)['Value'];
		return savedValue ?? fallback;
	}

	/**
	 * Obtains the store with the given name that holds the
	 * specified type of value.
	 *
	 * @param key the key of the store
	 * @param typeName the name of the type the store holds
	 * @returns the store, if one exists
	 */
	private getStore<T extends AllowedTypeNames>(key: string, typeName: T) {
		const store = this.stores.get(Conf.getTypedKey(key, typeName));
		if (store?.IsA(TypeNameToStoreClass[typeName])) return store;
	}

	/**
	 * Obtains the store with the given name that holds the
	 * specified type of value. If none exists, one is created
	 * and registered.
	 *
	 * @param key the key of the store
	 * @param typeName the name of the type the store holds
	 * @returns the existing or created store
	 */
	private ensureStore<T extends AllowedTypeNames>(key: string, typeName: T) {
		const existing = this.getStore(key, typeName);
		if (existing) return existing;
		return this.createStore(key, typeName);
	}

	/**
	 * Creates a store with the given name (key) that holds
	 * the specified type of value.
	 *
	 * After instantiation, this store is registered.
	 *
	 * @param key the key of the store
	 * @param typeName the name of the type the store holds
	 * @returns the created store
	 */
	private createStore<T extends AllowedTypeNames>(key: string, typeName: T) {
		const store = new Instance(TypeNameToStoreClass[typeName]);
		store.Name = key;
		store.Parent = this.inst;
		this.stores.set(Conf.getTypedKey(key, typeName), store);
		return store;
	}

	/**
	 * Takes an existing store and registers it.
	 * The type of store is inferred from the current value of the store.
	 *
	 * @param inst the existing store
	 */
	private registerExistingStore(inst: ValueBase) {
		const typeName = Conf.getTypeName(inst.Value);
		if (typeName === undefined) return warn(`Unsupported store found ${inst.GetFullName()}.`);

		this.stores.set(Conf.getTypedKey(inst.Name, typeName), inst);
	}

	/**
	 * This returns the type name of a given value.
	 *
	 * This is a utility function that ensures that the type name
	 * is only returned if it is supported by Conf. This means the result of this
	 * function is casted into a key of {@link TypeNameToType}.
	 *
	 * @param value the value
	 * @returns the type name, if it is supported
	 */
	private static getTypeName<T extends unknown>(value: T) {
		const name = typeOf(value);
		if (name in TypeNameToStoreClass) return name as ExtractKeys<TypeNameToType, ToPrimitive<T>>;
	}

	/**
	 * Returns the specified key joined with the specified type name.
	 *
	 * This allows for the same key to be associated with
	 * stores that hold different types of values.
	 *
	 * @param key the key to join
	 * @param typeName the type name to join
	 */
	private static getTypedKey(key: string, typeName: AllowedTypeNames) {
		if (key.match(this.TYPED_KEY_SEP))
			throw `Invalid key specified: "${key}". The key cannot include the internal seperator: "${this.TYPED_KEY_SEP}"`;

		const storeName = TypeNameToStoreClass[typeName];
		return `${key}${this.TYPED_KEY_SEP}${storeName}`;
	}

	/**
	 * Returns the first part of the specified typed key, after it is
	 * split by the {@link Conf.TYPED_KEY_SEP}.
	 *
	 * If this key was joined by {@link Conf.getTypedKey} then this will
	 * be the non-unique name of the value instance.
	 *
	 * @param typedKey the joined (typed) key
	 * @returns the unjoined (untyped) key
	 */
	private static getUntypedKey(typedKey: string) {
		return typedKey.split(this.TYPED_KEY_SEP)[0];
	}
}
