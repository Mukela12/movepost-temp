import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_API_URL = 'https://api.resend.com/emails'

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the request is authorized
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Parse request body
    const emailData: EmailRequest = await req.json()

    // Validate required fields
    if (!emailData.to || !emailData.subject || !emailData.html) {
      throw new Error('Missing required fields: to, subject, or html')
    }

    // Set default from email
    const from = emailData.from || `MovePost <${Deno.env.get('EMAIL_FROM') || 'contact@fluxium.dev'}>`

    console.log('Sending email to:', emailData.to)
    console.log('Subject:', emailData.subject)

    // Send email via Resend API
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
        subject: emailData.subject,
        html: emailData.html,
        reply_to: emailData.replyTo,
      }),
    })

    const resendData = await res.json()

    if (!res.ok) {
      console.error('Resend API error:', resendData)
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`)
    }

    console.log('Email sent successfully:', resendData)

    return new Response(
      JSON.stringify({
        success: true,
        id: resendData.id,
        message: 'Email sent successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
