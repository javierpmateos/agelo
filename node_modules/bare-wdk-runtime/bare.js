require('bare-fetch/global')
require('bare-encoding/global')
require('bare-crypto/global')

const { AbortController } = require('abort-controller')
const { EventTarget } = require('event-target-shim')
const process = require('bare-process')

global.AbortController = AbortController
global.EventTarget = EventTarget
global.process = process
