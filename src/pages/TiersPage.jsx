import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const TIERS = [
  {
    name: 'Sprout',
    icon: '🌱',
    min: 0,
    max: 99,
    color: '#f0fdf4',
    border: '#86efac',
    accent: '#166534',
    badge: '#dcfce7',
    perks: [
      'Access to the full restaurant directory',
      'Vote on amenities and earn points',
      'Save favorite restaurants',
      'Write reviews',
    ],
    description: 'Every Little Foodies parent starts here. You\'re just getting started — explore your neighborhood and help other families!'
  },
  {
    name: 'Explorer',
    icon: '🗺️',
    min: 100,
    max: 499,
    color: '#eff6ff',
    border: '#93c5fd',
    accent: '#1e40af',
    badge: '#dbeafe',
    perks: [
      'Everything in Sprout',
      'Explorer badge on your profile',
      'Early access to new features',
      'Featured in community highlights',
    ],
    description: 'You\'re getting the hang of it! You\'ve been actively helping other parents find family-friendly spots.'
  },
  {
    name: 'Guide',
    icon: '🧭',
    min: 500,
    max: 999,
    color: '#fefce8',
    border: '#fde047',
    accent: '#854d0e',
    badge: '#fef9c3',
    perks: [
      'Everything in Explorer',
      'Guide badge on your profile',
      'Priority support',
      'Invites to beta features',
      'Shoutout on our Instagram',
    ],
    description: 'You\'re a trusted voice in the Little Foodies community. Other parents count on your reviews and votes!'
  },
  {
    name: 'Champion',
    icon: '🏆',
    min: 1000,
    max: 2499,
    color: '#fff7ed',
    border: '#fdba74',
    accent: '#7c2d12',
    badge: '#ffedd5',
    perks: [
      'Everything in Guide',
      'Champion badge on your profile',
      'Free entry to Little Foodies events',
      'Partner restaurant perks & discounts',
      'Monthly Champion newsletter',
    ],
    description: 'Incredible! You\'re one of the most active parents in the community. Restaurants and families know your name.'
  },
  {
    name: 'Legend',
    icon: '⭐',
    min: 2500,
    max: Infinity,
    color: '#fdf2f8',
    border: '#f0abfc',
    accent: '#701a75',
    badge: '#fae8ff',
    perks: [
      'Everything in Champion',
      'Legend badge on your profile',
      'Annual Little Foodies gift box',
      'Co-branded events with partner restaurants',
      'Listed on our website as a community Legend',
      'Lifetime free ticket to all Little Foodies events',
    ],
    description: 'The highest honor in Little Foodies. You\'ve gone above and beyond for families in your community. Thank you! 🙏'
  },
]

function getTier(pts) {
  return TIERS.findLast(t => pts >= t.min) || TIERS[0]
}

export default function TiersPage() {
  const { user } = useAuth()
  const [profile, setProfile] = require('react').useState(null)

  require('react').useEffect(() => {
    if (!user) return
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('profiles').select('points, display_name').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [user])

  const pts        = profile?.points || 0
  const currentTier = getTier(pts)

  return (
    <div style={{ ...font, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb',
        background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/profile" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: "'IntroRust', cursive" }}>
          Community Tiers
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #f57b46 0%, #f46ab8 100%)',
        padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginBottom: 4 }}>
          Your current tier
        </div>
        <div style={{ fontSize: 40, marginBottom: 4 }}>{currentTier.icon}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff',
          fontFamily: "'IntroRust', cursive", marginBottom: 4 }}>
          {currentTier.name}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
          {pts} points earned
        </div>
      </div>

      {/* Intro */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12,
          padding: '14px', marginBottom: 4 }}>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            Earn points by voting on amenities, adding restaurants, writing reviews, and attending family events.
            The more you contribute, the higher your tier — and the better the perks!
          </div>
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TIERS.map((tier, i) => {
          const isCurrent = tier.name === currentTier.name
          const isAchieved = pts >= tier.min
          const isNext = !isAchieved && TIERS[i - 1] && pts >= TIERS[i - 1].min
          const ptsNeeded = tier.min - pts

          return (
            <div key={tier.name} style={{
              background: isCurrent ? tier.color : '#fff',
              border: isCurrent ? '2px solid ' + tier.border : '0.5px solid #e5e7eb',
              borderRadius: 16, overflow: 'hidden',
              boxShadow: isCurrent ? '0 4px 20px rgba(0,0,0,.08)' : 'none',
              opacity: isAchieved ? 1 : 0.7,
            }}>

              {/* Current indicator */}
              {isCurrent && (
                <div style={{ background: tier.accent, padding: '4px 14px',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  ← Your current tier
                </div>
              )}
              {isNext && (
                <div style={{ background: '#f57b46', padding: '4px 14px',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Next up — {ptsNeeded} pts to go!
                </div>
              )}

              <div style={{ padding: '16px 16px 14px' }}>
                {/* Tier header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14,
                    background: tier.badge, border: '1.5px solid ' + tier.border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0 }}>
                    {tier.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: tier.accent,
                      fontFamily: "'IntroRust', cursive" }}>
                      {tier.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                      {tier.max === Infinity
                        ? tier.min.toLocaleString() + '+ points'
                        : tier.min.toLocaleString() + ' – ' + tier.max.toLocaleString() + ' points'}
                    </div>
                  </div>
                  {isAchieved && (
                    <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                      background: tier.badge, color: tier.accent,
                      border: '1px solid ' + tier.border,
                      padding: '3px 10px', borderRadius: 20 }}>
                      ✓ Achieved
                    </div>
                  )}
                </div>

                {/* Description */}
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 12 }}>
                  {tier.description}
                </div>

                {/* Perks */}
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  Perks
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tier.perks.map(perk => (
                    <div key={perk} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 12, color: isAchieved ? tier.accent : '#9ca3af',
                        flexShrink: 0, marginTop: 1 }}>
                        {isAchieved ? '✓' : '○'}
                      </span>
                      <span style={{ fontSize: 12, color: isAchieved ? '#374151' : '#9ca3af',
                        lineHeight: 1.5 }}>
                        {perk}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Progress if next tier */}
                {isNext && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>
                      <span>{pts} pts</span>
                      <span>{tier.min} pts needed</span>
                    </div>
                    <div style={{ height: 5, background: '#e5e7eb', borderRadius: 3,
                      overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#f57b46', borderRadius: 3,
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
      <div style={{ margin: '16px 16px 0', background: '#fff3ee',
        border: '0.5px solid #fdc9b0', borderRadius: 12, padding: '16px',
        textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#c2410c', marginBottom: 4 }}>
          Keep earning points! 🏅
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
          Vote on amenities, add restaurants, write reviews — every action counts toward your next tier.
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
