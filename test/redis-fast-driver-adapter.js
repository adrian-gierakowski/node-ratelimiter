const commands = require('redis-commands/commands.json')
const RedisFastDriver = require('redis-fast-driver')

const forwardMembers = ['on', 'once', 'removeListener', 'rawCall', 'rawCallAsync']

const isString = v => ( typeof v === 'string' ) || v instanceof String

const nodeRedisToFastDriverAdapter = {
  set: function(redisFastDriver, key, val) {
    redisFastDriver[key] = val;
    return true;
  },
  get: function(redisFastDriver, key) {
    if (!isString(key)) return redisFastDriver[key]

    const split = key.split('Async')
    key = split[0]
    const rest = split[1]
    const isAsync = rest === ''

    if (forwardMembers.includes(key)) {
      const v = redisFastDriver[isAsync ? key + 'Async' : key]
      if (typeof v === 'function') {
        return v.bind(redisFastDriver)
      } else {
        return v
      }
    } else if (commands[key.toLowerCase()] || key === 'send_command') {
      return function(...args) {
        args = [].concat.apply([], args)

        let cb = args[args.length - 1]
        if (typeof cb === 'function') {
          args.pop()
        } else {
          cb = void 0
        }
        if (!['send_command', 'multi'].includes(key)) {
          args = [key].concat(args)
        }

        if (key === 'multi') {
          if (cb != null) {
            throw new Error('multi does not support callback. Add callback to exec call instead')
          } {
            redisFastDriver.rawCall(['multi'])
            for (const subCommand of args) {
              redisFastDriver.rawCall(subCommand)
            }
          }
        } else {
          const f = redisFastDriver[isAsync ? 'rawCallAsync' : 'rawCall']
          if (cb != null) {
            f.call(redisFastDriver, args, cb)
          } else {
            f.call(redisFastDriver, args)
          }
        }

        return this
      };
    }
  }
};

const adaptClient = rfdClient => new Proxy(rfdClient, nodeRedisToFastDriverAdapter)

module.exports = {
  adaptClient,
  createClient: () => adaptClient(new RedisFastDriver())
}
