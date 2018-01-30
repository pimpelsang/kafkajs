const Runner = require('../runner')
const { KafkaJSProtocolError } = require('../../errors')
const { createErrorFromCode } = require('../../protocol/error')
const { newLogger } = require('testHelpers')

const UNKNOWN = -1
const REBALANCE_IN_PROGRESS = 27
const rebalancingError = () => new KafkaJSProtocolError(createErrorFromCode(REBALANCE_IN_PROGRESS))

describe('Consumer > Runner', () => {
  let runner, consumerGroup, onCrash

  beforeEach(() => {
    onCrash = jest.fn()
    consumerGroup = { join: jest.fn(), sync: jest.fn() }
    runner = new Runner({ consumerGroup, onCrash, logger: newLogger() })
  })

  describe('when the group is rebalancing before the new consumer has joined', () => {
    it('recovers from rebalance in progress and re-join the group', async () => {
      consumerGroup.sync
        .mockImplementationOnce(() => {
          throw rebalancingError()
        })
        .mockImplementationOnce(() => {
          throw rebalancingError()
        })
        .mockImplementationOnce(() => true)

      runner.scheduleFetch = jest.fn()
      await runner.start()
      expect(runner.scheduleFetch).toHaveBeenCalled()
      expect(onCrash).not.toHaveBeenCalled()
    })
  })

  it('calls onCrash for any other errors', async () => {
    const unknowError = new KafkaJSProtocolError(createErrorFromCode(UNKNOWN))
    consumerGroup.join
      .mockImplementationOnce(() => {
        throw unknowError
      })
      .mockImplementationOnce(() => true)

    runner.scheduleFetch = jest.fn()
    await runner.start()
    expect(runner.scheduleFetch).not.toHaveBeenCalled()
    expect(onCrash).toHaveBeenCalledWith(unknowError)
  })
})
