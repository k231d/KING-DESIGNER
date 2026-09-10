from pathlib import Path
p = Path('/home/ubuntu/king-design-published/client/src/pages/ProfilePage.tsx')
s = p.read_text()
needle = """      {showRatingModal && <RatingModal targetUser={user} onClose={() => setShowRatingModal(false)} onSubmit={handleRateDesigner} />}\n    </div>\n  );\n}\n// --- Folder Detail View ---"""
replacement = """      {showRatingModal && <RatingModal targetUser={user} onClose={() => setShowRatingModal(false)} onSubmit={handleRateDesigner} />}\n        </div>\n      </div>\n    </>\n  );\n}\n// --- Folder Detail View ---"""
if needle not in s:
    raise RuntimeError('profile ending not found')
s = s.replace(needle, replacement, 1)
s = s.replace("style={user.profile_card_url ? { backgroundImage: `url(${user.profile_card_url})`, backgroundSize: 'cover' } : undefined}", "style={activeProfileCardUrl ? { backgroundImage: `url(${activeProfileCardUrl})`, backgroundSize: 'cover' } : undefined}", 1)
p.write_text(s)
print('profile completed')
