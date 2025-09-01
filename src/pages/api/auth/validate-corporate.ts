import { NextApiRequest, NextApiResponse } from 'next';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dealId, email } = req.body;

  if (!dealId || !email) {
    return res.status(400).json({ error: 'Missing dealId or email' });
  }

  if (!HUBSPOT_API_KEY) {
    console.error('HUBSPOT_API_KEY not configured');
    return res.status(500).json({ error: 'HubSpot integration not configured' });
  }

  try {
    // Fetch deal from HubSpot
    const dealResponse = await fetch(
      `${HUBSPOT_API_URL}/crm/v3/objects/deals/${dealId}?associations=contacts`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!dealResponse.ok) {
      if (dealResponse.status === 404) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      throw new Error(`HubSpot API error: ${dealResponse.status}`);
    }

    const dealData = await dealResponse.json();

    // Get associated contacts
    const contactsResponse = await fetch(
      `${HUBSPOT_API_URL}/crm/v3/objects/deals/${dealId}/associations/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!contactsResponse.ok) {
      throw new Error(`Failed to fetch contacts: ${contactsResponse.status}`);
    }

    const contactsData = await contactsResponse.json();
    const contactIds = contactsData.results?.map((r: any) => r.id) || [];

    if (contactIds.length === 0) {
      return res.status(400).json({ error: 'No contacts associated with deal' });
    }

    // Fetch contact details to get emails
    const contactPromises = contactIds.map((id: string) =>
      fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/${id}?properties=email`, {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }).then(r => r.json())
    );

    const contacts = await Promise.all(contactPromises);
    const contactEmails = contacts
      .map((c: any) => c.properties?.email)
      .filter(Boolean)
      .map((e: string) => e.toLowerCase());

    // Check if user email matches any contact email
    const isValidEmail = contactEmails.includes(email.toLowerCase());

    if (!isValidEmail) {
      console.log(`Email ${email} not found in deal ${dealId} contacts: ${contactEmails.join(', ')}`);
      return res.status(403).json({ 
        error: 'Email not authorized for this corporate account',
        valid: false 
      });
    }

    // Optional: Check deal stage (e.g., closed won)
    const dealStage = dealData.properties?.dealstage;
    const dealName = dealData.properties?.dealname;
    
    console.log(`Validated corporate registration: Deal ${dealId} (${dealName}), Stage: ${dealStage}, Email: ${email}`);

    return res.status(200).json({
      valid: true,
      dealId,
      dealName,
      dealStage,
      email
    });

  } catch (error) {
    console.error('Corporate validation error:', error);
    return res.status(500).json({ 
      error: 'Failed to validate corporate account',
      valid: false 
    });
  }
}