# Bee-Eyes Design Guidelines

## Design Approach: Gamified Productivity Hybrid

**Selected Approach:** Reference-based, inspired by addictive gamified productivity apps like Habitica, Duolingo, and cute Japanese productivity tools (Forest, Finch)

**Core Principle:** Create an irresistibly cute, rewarding experience that makes mundane tasks feel like an adventure. Every interaction should feel delightful and progress should be tangible.

---

## Color Palette

### Primary Bee Theme
- **Honey Yellow:** 45 95% 65% (primary brand, accents, positive feedback)
- **Deep Black:** 0 0% 15% (text, contrast elements)
- **Warm Amber:** 38 90% 55% (hover states, secondary actions)

### Supporting Colors
- **Soft Cream:** 48 40% 95% (light mode background)
- **Gentle Lavender:** 270 25% 90% (sections, cards in light mode)
- **Mint Green:** 150 40% 85% (completed tasks, success states)
- **Blush Pink:** 350 60% 90% (mood tracking, emotional elements)

### Dark Mode
- **Deep Charcoal:** 240 8% 12% (dark background)
- **Slate Gray:** 240 6% 18% (card backgrounds)
- **Muted Honey:** 45 60% 45% (primary in dark mode)
- **Soft highlights maintain pastels with reduced saturation**

### Functional Colors
- **XP/Progress:** Honey Yellow to Amber gradient
- **Achievements:** Gold accents (45 80% 60%)
- **Streaks:** Orange-red gradient (15 90% 60%)
- **Mood tracking:** Rainbow pastels (variable hues, 60% saturation, 85% lightness)

---

## Typography

### Font Families
- **Primary (UI):** 'Nunito' - rounded, friendly, highly legible
- **Accent (Headers/Fun):** 'Fredoka' - playful, bubbly for mission titles and achievements
- **Monospace (Stats):** 'JetBrains Mono' - for XP counters and numerical displays

### Type Scale
- **Hero/Mission Titles:** text-2xl to text-4xl, font-bold (Fredoka)
- **Body Chat:** text-base, font-medium (Nunito)
- **UI Labels:** text-sm, font-semibold
- **Micro (Stats/XP):** text-xs to text-sm, tracking-wide (JetBrains Mono)

---

## Layout System

### Spacing Primitives
**Core units:** 2, 4, 8, 12, 16 (tailwind scale)
- **Tight spacing:** p-2, gap-2 (within components)
- **Standard spacing:** p-4, gap-4 (between elements)
- **Section spacing:** p-8, py-12 (major sections)
- **Comfortable breathing:** p-16 (around main content areas)

### Grid Structure
- **Main Layout:** Two-column split on desktop (chat 60% | mission panel 40%)
- **Mobile:** Stacked single column with bottom tab navigation
- **Mission Panel:** Grid of 2 cards on larger screens, single column on mobile

---

## Component Library

### 1. Animated Bee Eyes (Header)
**Position:** Fixed top of chat area, always visible
- Large expressive anime-style eyes with bee characteristics (hexagonal pupils)
- Expression states: neutral, happy, excited, curious, sleepy, celebrating
- Micro-animations: blink every 3-5s, look towards new messages, bounce on achievements
- Size: h-24 w-32 on desktop, h-16 w-24 on mobile
- Background: Subtle honey-colored glow effect

### 2. Chat Interface
- **Message bubbles:** Rounded-3xl, user (amber/yellow), assistant (lavender/slate)
- **Spacing:** gap-4 between messages
- **Timestamps:** text-xs, opacity-60, above each message
- **Input field:** Rounded-full, shadow-lg, with send button integrated
- **Max width:** max-w-2xl for readability

### 3. Mission Panel
**Card Design:**
- Rounded-2xl cards with soft shadow
- Gradient borders on active missions (yellow-to-amber)
- Icons on left (using Heroicons), progress bars below
- Checkbox animation: bounce + confetti particle effect on complete
- **States:** todo (neutral), active (highlighted border), completed (green checkmark + strikethrough)

**Progress Indicators:**
- Circular XP ring around bee avatar (top of panel)
- Linear progress bars for daily goals
- Streak counter with flame icon and number

### 4. Navigation
- **Desktop:** Minimal top bar with theme toggle, settings, profile avatar
- **Mobile:** Bottom tab bar (Chat, Missions, Mood, History)
- Icons from Heroicons with labels

### 5. Gamification Elements
**Level Badge:** Hexagon shape (bee cell reference) showing current level, floating above mission panel
**Achievement Popups:** Slide in from top-right, auto-dismiss after 4s, rounded-2xl with sparkle animation
**XP Counter:** Animated number increment with +XP floating particle effect
**Streak Display:** Fire emoji + number in bold, pulse animation on increment

### 6. Mood Tracker
- **Daily check-in:** 5 emoji buttons (very sad to very happy) in horizontal row
- **History view:** Calendar heatmap with color-coded days
- **Insights card:** Bee-eyes avatar with speech bubble showing patterns

### 7. Story/Narrative Panel
- **Unlockable chapters:** Cards with lock icons for locked content
- **Current story:** Scroll-based illustration with text overlay
- **Progress bar:** Shows story completion percentage

---

## Animations & Interactions

### Micro-interactions (Subtle)
- Button hover: scale(1.05) + brightness increase
- Card hover: translateY(-2px) + shadow increase
- Checkbox check: bounce animation + sound effect placeholder
- Message send: slide-up fade-in

### Reward Animations (Celebratory)
- Achievement unlock: Confetti burst (use canvas-confetti library)
- Level up: Screen flash + particle explosion from bee eyes
- Mission complete: Checkmark draw animation + success sound placeholder
- Streak milestone: Flame pulse + glow effect

### Eye Reactions (Expressive)
- New message: Eyes dart toward text, widen slightly
- Achievement: Eyes become stars, bounce excitedly
- Task complete: Eyes squint happily, slight head nod
- Long inactivity: Eyes droop, sleepy blink

### Transition Effects
- Theme switch: Smooth 300ms color transition on all elements
- Panel expand/collapse: 400ms ease-in-out with height animation
- Route changes: Fade cross-dissolve 200ms

---

## Images

**Hero/Welcome Section:**
- **Welcome screen (first time):** Large illustrated bee character (cute, friendly) welcoming user, centered on light gradient background (cream to lavender). Size: 400x400px, positioned top-third of screen
- **Dashboard header:** Small bee mascot icon (64x64px) next to welcome message "Bem-vindo de volta!"
- **Achievement badges:** Small illustrative icons (48x48px) for each achievement type
- **No large hero images** - interface is dashboard-focused, not marketing

**Illustration Style:** Flat, rounded, pastel-colored vector illustrations with soft shadows, consistent with bee/honey theme

---

## Accessibility & Theme Implementation

### Dark Mode Consistency
- All inputs, text fields, and interactive elements maintain dark backgrounds in dark mode
- Reduced contrast in dark mode (no pure white text, use cream tones)
- Illustrations adapt with darker outlines and muted colors

### Interaction States
- Focus rings: 2px solid amber with offset for keyboard navigation
- Disabled states: opacity-40 + cursor-not-allowed
- Loading states: Pulsing bee icon animation

### Responsive Breakpoints
- Mobile: base (< 768px) - stacked layout, bottom nav
- Tablet: md (768px+) - transitional layout, side panel appears
- Desktop: lg (1024px+) - full two-column layout with expanded mission panel

---

## Design Execution Notes

**Priority 1 (MVP):**
- Functional chat with animated bee eyes
- Mission panel with task CRUD
- Basic gamification (XP, level display)
- Theme switching

**Priority 2 (Enhance addiction):**
- Achievement system with celebratory animations
- Mood tracking integration
- Streak mechanics

**Priority 3 (Depth):**
- Story progression system
- Advanced analytics on habits/mood
- Social features (optional future)

**Critical Success Factors:**
- Eyes must be expressive and reactive - this is the "soul" of the app
- Every completed action needs positive reinforcement (visual/auditory)
- Progression must be visible and satisfying
- Interface must feel alive, not static