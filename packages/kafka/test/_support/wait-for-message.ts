import { KafkaAdapter, KafkaContext } from '@opra/kafka';

const waitList = new Set();

export async function waitForMessage(
  adapter: KafkaAdapter,
  oprname: string,
  key: any,
  timeout = 10000,
): Promise<KafkaContext> {
  return new Promise((resolve, reject) => {
    const waitKey = oprname + ':' + key;
    waitList.add(waitKey);
    const timeoutTimer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message with key "${key}"`));
    }, timeout);
    const onMessage = async (_ctx: KafkaContext) => {
      if (_ctx.__oprDef?.name === oprname) {
        if (_ctx.key === key) {
          adapter.removeListener('error', onError);
          adapter.removeListener('finish', onMessage);
          waitList.delete(waitKey);
          clearTimeout(timeoutTimer);
          resolve(_ctx);
        } else {
          if (waitList.has(waitKey)) return;

          console.log(
            `Warning: Waiting message with "${key}" key but god message with "${_ctx.key}"`,
          );
        }
      } else {
        if (waitList.has(waitKey)) return;

        console.log(
          `Warning: Waiting message for "${oprname}" operation but god message for "${_ctx.__oprDef?.name}"`,
        );
      }
    };
    const onError = (e: any) => {
      waitList.delete(waitKey);
      adapter.removeListener('finish', onMessage);
      clearTimeout(timeoutTimer);
      reject(e);
    };
    adapter.on('finish', onMessage);
    adapter.once('error', onError);
  });
}
