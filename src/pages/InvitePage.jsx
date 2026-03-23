import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }
const APP_URL = 'https://little-foodies.pages.dev'

export default function InvitePage() {
  const { user } = useAuth()
  const [code, setCode]         = useState('')
  const [copied, setCopied]     = useState(false)
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!user) return
    loadReferralData()
  }, [user])

  async function loadReferralData() {
    // Get or generate referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single()

    let refCode = profile?.referral_code
    if (!refCode) {
      // Generate a code from their user ID
      refCode = user.id.replace(/-/g, '').substring(0, 8).toUpperCase()
      await supabase.from('profiles')
        .update({ referral_code: refCode })
        .eq('id', user.id)
    }
    setCode(refCode)

    // Load referrals
    const { data: refs } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })
    setReferrals(refs || [])
    setLoading(false)
  }

  const inviteLink = APP_URL + '?ref=' + code
  const completedReferrals = referrals.filter(r => r.status === 'completed').length
  const pendingReferrals   = referrals.filter(r => r.status === 'pending').length

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = inviteLink
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  function shareViaText() {
    const msg = "I've been using Little Foodies to find family-friendly restaurants near us — high chairs, kids menus, changing tables all verified by real parents! Check it out: " + inviteLink
    window.open('sms:?body=' + encodeURIComponent(msg))
  }

  function shareViaEmail() {
    const subject = "Found a great app for finding family-friendly restaurants!"
    const body = "Hey!\n\nI've been using Little Foodies to find family-friendly restaurants near us. Real parents verify amenities like high chairs, kids menus, and changing tables so you actually know what to expect before you go.\n\nJoin me here: " + inviteLink + "\n\nHope to see you there!"
    window.open('mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body))
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({
        title: 'Little Foodies',
        text: "Find family-friendly restaurants verified by real parents!",
        url: inviteLink,
      })
    } else {
      copyLink()
    }
  }

  return (
    <div style={{ ...font, paddingBottom: 80, background: '#f9fafb', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb',
        background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/profile" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Invite friends</div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #00a994 0%, #0692e5 100%)',
        padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>👨‍👩‍👧‍👦</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6,
          fontFamily: "'IntroRust', cursive" }}>
          Invite your village
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', lineHeight: 1.6,
          maxWidth: 280, margin: '0 auto' }}>
          Share Little Foodies with other parents and earn <strong style={{ color: '#fff' }}>50 points</strong> for every friend who joins!
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Referral stats */}
        {(completedReferrals > 0 || pendingReferrals > 0) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#e6f7f5', border: '0.5px solid #99ddd6',
              borderRadius: 12, padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#065f55' }}>{completedReferrals}</div>
              <div style={{ fontSize: 11, color: '#065f55', fontWeight: 500 }}>Friends joined</div>
              <div style={{ fontSize: 11, color: '#00a994', fontWeight: 600, marginTop: 2 }}>
                +{completedReferrals * 50} pts earned
              </div>
            </div>
            <div style={{ flex: 1, background: '#fefae8', border: '0.5px solid #fde9a0',
              borderRadius: 12, padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#854d0e' }}>{pendingReferrals}</div>
              <div style={{ fontSize: 11, color: '#854d0e', fontWeight: 500 }}>Invites sent</div>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginTop: 2 }}>
                pending signup
              </div>
            </div>
          </div>
        )}

        {/* Your invite link */}
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
          borderRadius: 14, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            Your personal invite link
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center',
            background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ flex: 1, fontSize: 12, color: '#6b7280',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {inviteLink}
            </div>
            <button onClick={copyLink}
              style={{ padding: '5px 12px', background: copied ? '#e6f7f5' : '#f57b46',
                border: 'none', borderRadius: 8, color: copied ? '#065f55' : '#fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, ...font,
                transition: 'all .2s' }}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          {/* Your referral code */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff3ee', border: '0.5px solid #fdc9b0',
            borderRadius: 10, padding: '10px 14px' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#c2410c',
                textTransform: 'uppercase', letterSpacing: '.06em' }}>Your referral code</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f57b46',
                letterSpacing: '.1em', marginTop: 2 }}>{code}</div>
            </div>
            <button onClick={copyLink}
              style={{ padding: '6px 14px', background: '#f57b46', border: 'none',
                borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', ...font }}>
              Share code
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

          {/* Native share (mobile) */}
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={shareNative}
              style={{ width: '100%', padding: '14px 0', background: '#f57b46', border: 'none',
                borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', ...font, boxShadow: '0 4px 14px rgba(245,123,70,.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📤</span> Share Little Foodies
            </button>
          )}

          {/* Text message */}
          <button onClick={shareViaText}
            style={{ width: '100%', padding: '13px 0', background: '#fff',
              border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#374151',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Send a text message</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                Opens your messages app
              </div>
            </div>
          </button>

          {/* Email */}
          <button onClick={shareViaEmail}
            style={{ width: '100%', padding: '13px 16px', background: '#fff',
              border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#374151',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
              display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✉️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Send an email</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                Opens your email app
              </div>
            </div>
          </button>

          {/* Copy link */}
          <button onClick={copyLink}
            style={{ width: '100%', padding: '13px 16px', background: '#fff',
              border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#374151',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
              display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{copied ? '✅' : '🔗'}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {copied ? 'Link copied!' : 'Copy invite link'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                Paste anywhere
              </div>
            </div>
          </button>
        </div>

        {/* How it works */}
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
          borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            How referrals work
          </div>
          {[
            { step: '1', text: 'Share your personal invite link or code with another parent', icon: '📤' },
            { step: '2', text: 'They sign up for Little Foodies using your link', icon: '👤' },
            { step: '3', text: 'You automatically earn 50 points — no action needed!', icon: '🏅' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
              marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff3ee',
                border: '1.5px solid #fdc9b0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, paddingTop: 6 }}>
                {s.text}
              </div>
            </div>
          ))}
          <div style={{ background: '#fff3ee', border: '0.5px solid #fdc9b0',
            borderRadius: 10, padding: '10px 12px', fontSize: 12,
            color: '#c2410c', fontWeight: 600, textAlign: 'center' }}>
            No limit — invite as many friends as you want! 🎉
          </div>
        </div>

      </div>
    </div>
  )
}
