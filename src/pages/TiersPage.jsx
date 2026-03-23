import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const TIERS = [
  {
    name: 'Sprout', icon: '🌱', min: 0, max: 99,
    color: '#f0fdf4', border: '#86efac', accent: '#166534', badge: '#dcfce7',
    description: "Every Little Foodies parent starts here. You're just getting started — explore your neighborhood and help other families!",
    perks: [
      'Access to the full restaurant directory',
      'Vote on amenities and earn points',
      'Save favorite restaurants',
      'Write reviews',
    ]
  },
  {
    name: 'Explorer', icon: '🗺️', min: 100, max: 499,
    color: '#eff6ff', border: '#93c5fd', accent: '#1e40af', badge: '#dbeafe',
    description: "You're getting the hang of it! You've been actively helping other parents find family-friendly spots.",
    perks: [
      'Everything in Sprout',
      'Explorer badge on your profile',
      'Early access to new features',
      'Featured in community highlights',
    ]
  },
  {
    name: 'Guide', icon: '🧭', min: 500, max: 999,
    color: '#fefce8', border: '#fde047', accent: '#854d0e', badge: '#fef9c3',
    description: "You're a trusted voice in the Little Foodies community. Other parents count on your reviews and votes!",
    perks: [
      'Everything in Explorer',
      'Guide badge on your profile',
      'Priority support',
      'Invites to beta features',
      'Shoutout on our Instagram',
    ]
  },
  {
    name: 'Champion', icon: '🏆', min: 1000, max: 2499,
    color: '#fff7ed', border: '#fdba74', accent: '#7c2d12', badge: '#ffedd5',
    description: "Incredible! You're one of the most active parents in the community. Restaurants and families know your name.",
    perks: [
      'Everything in Guide',
      'Champion badge on your profile',
      'Free entry to Little Foodies events',
      'Partner restaurant perks and discounts',
      'Monthly Champion newsletter',
    ]
  },
  {
    name: 'Legend', icon: '⭐', min: 2500, max: Infinity,
    color: '#fdf2f8', border: '#f0abfc', accent: '#701a75', badge: '#fae8ff',
    description: "The highest honor in Little Foodies. You've gone above and beyond for families in your community. Thank you!",
    perks: [
      'Everything in Champion',
      'Legend badge on your profile',
      'Annual Little Foodies gift box',
      'Co-branded events with partner restaurants',
      'Listed on our website as a community Legend',
      'Lifetime free ticket to all Little Foodies events',
    ]
  },
]

function getCurrentTier(pts) {
  let current = TIERS[0]
  for (const t of TIERS) {
    if (pts >= t.min) current = t
  }
  return current
}

export default function TiersPage() {
  const { user } = useAuth()
  const [pts, setPts] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('points').eq('id', user.id).single()
      .then(({ data }) => { if (data) setPts(data.points || 0) })
  }, [user])

  const currentTier = getCurrentTier(pts)
  const nextTier    = TIERS.find(t => t.min > pts) || null

  return (
    <div style={{ ...font, paddingBottom: 80, background: '#f9fafb', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb',
        background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/profile"
          style={{ color: '#6b7280', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827',
          fontFamily: "'IntroRust', cursive" }}>
          Community Tiers
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #f57b46 0%, #f46ab8 100%)',
        padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)',
          textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
          Your current tier
        </div>
        <div style={{ fontSize: 44, marginBottom: 6 }}>{currentTier.icon}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#fff',
          fontFamily: "'IntroRust', cursive", marginBottom: 6 }}>
          {currentTier.name}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
          {pts} points earned
        </div>
        {nextTier && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>
              {nextTier.min - pts} pts until {nextTier.icon} {nextTier.name}
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.25)',
              borderRadius: 3, overflow: 'hidden', maxWidth: 240, margin: '0 auto' }}>
              <div style={{ height: '100%', background: '#fff', borderRadius: 3,
                width: Math.round(((pts - currentTier.min) / (nextTier.min - currentTier.min)) * 100) + '%',
                transition: 'width .6s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Intro card */}
      <div style={{ margin: '14px 16px 8px', background: '#fff',
        border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px' }}>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
          Earn points by voting on amenities, adding restaurants, writing reviews, and attending family events.
          The more you contribute, the higher your tier — and the better the perks!
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TIERS.map((tier) => {
          const isCurrent  = tier.name === currentTier.name
          const isAchieved = pts >= tier.min
          const isNext     = nextTier && tier.name === nextTier.name
          const ptsNeeded  = tier.min - pts

          return (
            <div key={tier.name} style={{
              background: isCurrent ? tier.color : '#fff',
              border: isCurrent ? '2px solid ' + tier.border : '0.5px solid #e5e7eb',
              borderRadius: 16, overflow: 'hidden',
              opacity: isAchieved ? 1 : 0.75,
            }}>
              {/* Banner */}
              {isCurrent && (
                <div style={{ background: tier.accent, padding: '5px 14px',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Your current tier
                </div>
              )}
              {isNext && (
                <div style={{ background: '#f57b46', padding: '5px 14px',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Next up — {ptsNeeded} pts to go!
                </div>
              )}

              <div style={{ padding: '16px' }}>
                {/* Tier header */}
                <div style={{ display: 'flex', alignItems: 'center',
                  gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 14,
                    background: tier.badge, border: '1.5px solid ' + tier.border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, flexShrink: 0 }}>
                    {tier.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: tier.accent,
                      fontFamily: "'IntroRust', cursive" }}>
                      {tier.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {tier.max === Infinity
                        ? tier.min.toLocaleString() + '+ points'
                        : tier.min.toLocaleString() + ' – ' + tier.max.toLocaleString() + ' points'}
                    </div>
                  </div>
                  {isAchieved && (
                    <div style={{ fontSize: 10, fontWeight: 700,
                      background: tier.badge, color: tier.accent,
                      border: '1px solid ' + tier.border,
                      padding: '3px 10px', borderRadius: 20 }}>
                      ✓ Achieved
                    </div>
                  )}
                </div>

                {/* Description */}
                <div style={{ fontSize: 12, color: '#6b7280',
                  lineHeight: 1.6, marginBottom: 12 }}>
                  {tier.description}
                </div>

                {/* Perks */}
                <div style={{ fontSize: 10, fontWeight: 700, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                  Perks included
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tier.perks.map(perk => (
                    <div key={perk} style={{ display: 'flex',
                      alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1,
                        color: isAchieved ? tier.accent : '#d1d5db' }}>
                        {isAchieved ? '✓' : '○'}
                      </span>
                      <span style={{ fontSize: 12, lineHeight: 1.5,
                        color: isAchieved ? '#374151' : '#9ca3af' }}>
                        {perk}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Next tier progress bar */}
                {isNext && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, color: '#9ca3af', marginBottom: 5 }}>
                      <span>{pts} pts</span>
                      <span>{tier.min.toLocaleString()} pts needed</span>
                    </div>
                    <div style={{ height: 5, background: '#e5e7eb',
                      borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#f57b46',
                        borderRadius: 3,
                        width: Math.round((pts / tier.min) * 100) + '%' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom CTA */}
      <div style={{ margin: '16px', background: '#fff3ee',
        border: '0.5px solid #fdc9b0', borderRadius: 12,
        padding: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#c2410c', marginBottom: 4 }}>
          Keep earning points! 🏅
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
          Vote on amenities, add restaurants, write reviews — every action counts!
        </div>
        <Link to="/" style={{ display: 'inline-block', padding: '10px 24px',
          background: '#f57b46', color: '#fff', borderRadius: 10,
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(245,123,70,.35)' }}>
          Start exploring
        </Link>
      </div>
    </div>
  )
}
