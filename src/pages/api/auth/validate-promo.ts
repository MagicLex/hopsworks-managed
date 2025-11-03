import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { promoCode } = req.body;

  if (!promoCode) {
    return res.status(400).json({ error: 'Missing promoCode' });
  }

  // Validate that promo code starts with HOPS_ (case-insensitive)
  const normalizedCode = promoCode.toUpperCase().trim();

  if (!normalizedCode.startsWith('HOPS_')) {
    return res.status(400).json({
      error: 'Invalid promo code format. Must start with HOPS_',
      valid: false
    });
  }

  // Ensure there's at least one character after HOPS_
  if (normalizedCode === 'HOPS_' || normalizedCode.length <= 5) {
    return res.status(400).json({
      error: 'Invalid promo code. Must include code after HOPS_ prefix',
      valid: false
    });
  }

  console.log(`Validated promotional code: ${normalizedCode}`);

  return res.status(200).json({
    valid: true,
    promoCode: normalizedCode
  });
}
