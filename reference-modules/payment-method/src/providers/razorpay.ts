import type { PaymentProvider } from './types';

// TODO: implement with the Razorpay SDK. Needs RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (secret) in requires.env.
//   attach: fetch the saved token/card via the Razorpay customers+tokens API
//   detach: delete the token via the same API
export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  async attach() { throw new Error('razorpay adapter not implemented (TODO)'); },
  async detach() { throw new Error('razorpay adapter not implemented (TODO)'); },
};
