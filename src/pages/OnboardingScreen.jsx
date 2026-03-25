import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const font = { fontFamily: "'Montserrat', sans-serif" }

const SLIDES = [
  {
    emoji: '🍕',
    bg: 'linear-gradient(135deg, #fff3ee 0%, #fef0f8 100%)',
    accent: '#f57b46',
    title: 'Find restaurants your\nwhole family will love',
    body: 'Search by zip code to discover kid-friendly restaurants near you, rated and reviewed by real parents in your community.',
    detail: null,
  },
  {
    emoji: '🪑',
    bg: 'linear-gradient(135deg, #e6f7f5 0%, #e8f4fd 100%)',
    accent: '#00a994',
    title: 'Know before you go',
    body: 'Every restaurant is verified by parents like you. See exactly what to expect — before you buckle the kids in.',
    detail: {
      items: [
        { icon: '🪑', label: 'High chairs' },
        { icon: '🍟', label: 'Kids menu' },
        { icon: '🚺', label: 'Changing tables' },
        { icon: '🛻', label: 'Stroller friendly' },
        { icon: '🌿', label: 'Outdoor seating' },
        { icon: '🤫', label: 'Quiet atmosphere' },
      ]
    }
  },
  {
    emoji: '🍜',
    bg: 'linear-gradient(135deg, #fefae8 0%, #fff3ee 100%)',
    accent: '#854d0e',
    title: 'Kids menus & allergen info',
    body: 'Browse kids menu photos before you arrive so your little ones already know what they want to order.',
    detail: {
      allergenNote: true,
      allergens: [
        { icon: '🥜', label: 'Peanut-free' },
        { icon: '🌰', label: 'Tree nut-free' },
        { icon: '🌾', label: 'Gluten-free' },
        { icon: '🥛', label: 'Dairy-free' },
      ]
    }
  },
  {
    emoji: '❤️',
    bg: 'linear-gradient(135deg, #fef0f8 0%, #fff3ee 100%)',
    accent: '#f46ab8',
    title: 'Share with friends\n& earn rewards',
    body: 'Share your favourite finds with other parents, see what friends are loving, and earn points every time you contribute.',
    detail: {
      points: [
        { icon: '📍', label: 'Add a restaurant', pts: '+50 pts' },
        { icon: '⭐', label: 'Write a review', pts: '+25 pts' },
        { icon: '🗳️', label: 'Vote on amenities', pts: '+5 pts' },
        { icon: '📤', label: 'Share with a friend', pts: '+10 pts' },
      ]
    }
  },
]

export default function OnboardingScreen({ onComplete }) {
  const [slide, setSlide] = useState(0)
  const navigate = useNavigate()
  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  function next() {
    if (isLast) return
    setSlide(slide + 1)
  }

  function finish(goToSignup) {
    onComplete()
    if (goToSignup) navigate('/login')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff',
      display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,.08)', ...font }}>

      {/* Skip button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 0' }}>
        <button onClick={() => finish(false)}
          style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
            color: '#9ca3af', cursor: 'pointer', ...font }}>
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        padding: '12px 28px 20px', overflowY: 'auto' }}>

        {/* Emoji hero */}
        <div style={{ width: 100, height: 100, borderRadius: 28, background: s.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 52, margin: '0 auto 24px', flexShrink: 0,
          boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}>
          {s.emoji}
        </div>

        {/* Title */}
        <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', textAlign: 'center',
          marginBottom: 14, lineHeight: 1.3, whiteSpace: 'pre-line',
          fontFamily: "'IntroRust', 'Georgia', serif" }}>
          {s.title}
        </div>

        {/* Body */}
        <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'center',
          lineHeight: 1.7, marginBottom: 24 }}>
          {s.body}
        </div>

        {/* Slide-specific detail */}
        {s.detail?.items && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {s.detail.items.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 20, background: '#f9fafb',
                border: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {s.detail?.allergenNote && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8,
              justifyContent: 'center', marginBottom: 12 }}>
              {s.detail.allergens.map(a => (
                <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 20, background: '#fefae8',
                  border: '1px solid #fde9a0', fontSize: 12, fontWeight: 600, color: '#854d0e' }}>
                  <span>{a.icon}</span><span>{a.label}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center',
              lineHeight: 1.6, padding: '0 8px' }}>
              * Allergen information is community-reported and unverified until confirmed by the restaurant owner when they claim their listing. Always confirm directly with the restaurant.
            </div>
          </>
        )}

        {s.detail?.points && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.detail.points.map(p => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', background: '#f9fafb',
                borderRadius: 12, padding: '10px 14px',
                border: '0.5px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{p.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f57b46' }}>{p.pts}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 16 }}>
        {SLIDES.map((_, i) => (
          <div key={i} onClick={() => setSlide(i)}
            style={{ width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
              background: i === slide ? s.accent : '#e5e7eb',
              transition: 'all .3s', cursor: 'pointer' }} />
        ))}
      </div>

      {/* Buttons */}
      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLast ? (
          <>
            <button onClick={() => finish(true)}
              style={{ width: '100%', padding: '14px 0', background: '#f57b46', border: 'none',
                borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', ...font, boxShadow: '0 4px 14px rgba(245,123,70,.35)' }}>
              Create a free account 🎉
            </button>
            <button onClick={() => finish(false)}
              style={{ width: '100%', padding: '13px 0', background: '#fff',
                border: '1.5px solid #e5e7eb', borderRadius: 14, color: '#6b7280',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font }}>
              Browse first
            </button>
          </>
        ) : (
          <button onClick={next}
            style={{ width: '100%', padding: '14px 0', background: s.accent, border: 'none',
              borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', ...font, boxShadow: `0 4px 14px ${s.accent}55` }}>
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
