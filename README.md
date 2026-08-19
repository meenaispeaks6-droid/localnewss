# Local News

**use image as inspiration**

# Local News




Site Name: Local News

Tagline: ___________




## Design System




Base: shadcn/ui neutral (oklch)

Primary: systemTeal (#30b0c7 / #40c8e0)

Destructive: systemRed (#e30000 / #ff453a)




Tint usage: bg-primary/30, border-primary/50, text-primary/70




Typography:

  Heading: Outfit (fontshare.com)

  Body: Switzer (fontshare.com)

  Weights: 600 headings, 400 body




```css

:root {

  --radius: 0.625rem;

  --background: oklch(1 0 0);

  --foreground: oklch(0.145 0 0);

  --card: oklch(1 0 0);

  --card-foreground: oklch(0.145 0 0);

  --popover: oklch(1 0 0);

  --popover-foreground: oklch(0.145 0 0);

  --secondary: oklch(0.97 0 0);

  --secondary-foreground: oklch(0.205 0 0);

  --muted: oklch(0.97 0 0);

  --muted-foreground: oklch(0.556 0 0);

  --border: oklch(0.922 0 0);

  --input: oklch(0.922 0 0);

  --ring: oklch(0.708 0 0);




  --primary: #30b0c7;

  --primary-foreground: #000;




  --destructive: #e30000;

  --destructive-foreground: #fff;

}




.dark {

  --background: oklch(0.145 0 0);

  --foreground: oklch(0.985 0 0);

  --card: oklch(0.205 0 0);

  --card-foreground: oklch(0.985 0 0);

  --popover: oklch(0.269 0 0);

  --popover-foreground: oklch(0.985 0 0);

  --secondary: oklch(0.269 0 0);

  --secondary-foreground: oklch(0.985 0 0);

  --muted: oklch(0.269 0 0);

  --muted-foreground: oklch(0.708 0 0);

  --border: oklch(1 0 0 / 10%);

  --input: oklch(1 0 0 / 15%);

  --ring: oklch(0.556 0 0);




  --primary: #40c8e0;

  --primary-foreground: #000;




  --destructive: #ff453a;

  --destructive-foreground: #fff;

}

```




## 1. Product Overview




A hyperlocal news platform designed to connect residents with the stories, events, and businesses that matter most in their immediate community. The platform delivers neighborhood-specific content including breaking local news, government updates, business profiles, event listings, and community announcements. Built with Vite, React, Tailwind CSS, shadcn/ui components, and Framer Motion.




## 2. Key Features & Requirements




### Homepage & Content Feed




**Requirements:**

- Display location-aware content based on selected neighborhood

- Feature top stories with large hero image and headline

- Show recent news articles in grid/list layout with thumbnails

- Include quick-access widgets for weather, events, and trending topics




**Mock Data:**

- **Hero Story:** "New Community Center Opens in Downtown District: $4.2M Facility Features Pool, Gym, and Meeting Spaces"

- **Neighborhoods:** Downtown District, Riverside Heights, Oakmont Village, Hillcrest Gardens, Parkside Commons




**Visual Requirements:**

- Hero article with full-width image w-full h-[400px] object-cover rounded-xl

- Article cards with thumbnail images aspect-video rounded-lg

- Category tags with color coding px-2 py-1 rounded-full text-xs font-medium

- Timestamp with relative time display text-muted-foreground text-sm

- Hover effects using Framer Motion (subtle scale and shadow on article cards)

- Responsive grid: 3 columns desktop, 2 tablet, 1 mobile




### Location Selection & Neighborhood Navigation




**Requirements:**

- Prominent location selector in header with dropdown

- Display current neighborhood selection

- Allow switching between different neighborhoods

- Persist location preference for returning visitors




**Visual Requirements:**

- Location selector button with map pin icon flex items-center gap-2 px-4 py-2 bg-card border rounded-lg

- Dropdown menu with smooth Framer Motion slide animation

- Active neighborhood highlighted with accent color bg-primary/10 border-primary/30

- Neighborhood list with article counts text-muted-foreground text-sm




### Event Calendar




**Requirements:**

- Display upcoming community events in calendar and list views

- Filter events by category (Community, Arts, Sports, Education)

- Show event details including date, time, location

- Include "Add to Calendar" functionality




**Mock Data:**

- "Downtown Farmers Market" - Every Saturday, 234 attending

- "City Council Meeting" - March 18, Government

- "Youth Basketball Tournament" - March 22-23, Sports




**Visual Requirements:**

- Calendar grid view grid grid-cols-7 gap-1

- Event indicators in calendar cells (colored dots for categories)

- List view cards bg-card p-6 rounded-xl shadow-sm border

- Category pills with color coding px-3 py-1 rounded-full text-sm

- "Add to Calendar" button bg-primary text-primary-foreground px-4 py-2 rounded-lg




### Local Business Directory




**Requirements:**

- Browse businesses by category and neighborhood

- Display business cards with essential information

- Show customer reviews and ratings

- Include "Open Now" filter




**Mock Data:**

- **Categories:** Restaurants (34), Shopping (28), Health & Wellness (21), Services (42)

- **Featured:** "Oakmont Bakery" - 4.8★ (127 reviews), Open 6 AM - 6 PM




**Visual Requirements:**

- Business cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6

- Featured listings with premium badge absolute top-4 right-4 px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs

- Star rating display flex items-center gap-1 text-primary

- Status indicator for "Open Now" px-2 py-1 bg-primary/20 text-primary rounded text-xs




### Community Bulletin Board




**Requirements:**

- Display community announcements, classifieds, and notices

- Categorize posts (For Sale, Services, Lost & Found, General)

- Show post date and expiration

- Include contact information for post authors




**Visual Requirements:**

- Post cards with clear category indicators border-l-4 border-primary pl-4

- "Verified Local" badge flex items-center gap-1 text-primary text-sm

- Contact button that reveals contact info with animation px-4 py-2 bg-primary text-primary-foreground rounded-lg




### Weather Integration




**Requirements:**

- Display current weather conditions for selected neighborhood

- Show 5-day forecast overview

- Display weather alerts and warnings




**Mock Data:**

- Temperature: 68°F, Feels Like: 66°F

- Conditions: Partly Cloudy

- 5-Day Forecast available




**Visual Requirements:**

- Widget card bg-gradient-to-br from-primary to-primary/80 p-6 rounded-xl text-primary-foreground

- Large temperature display text-5xl font-bold

- Weather icon with subtle Framer Motion floating animation

- Weather alerts banner bg-destructive text-destructive-foreground p-3 rounded-lg mb-4




### Premium Membership




**Requirements:**

- Display membership benefits and pricing tiers

- Show premium-only features (ad-free, early access)




**Mock Data:**

- Free: Access to all articles, event calendar

- Basic: $4.99/month - Ad-free, newsletters

- Premium: $9.99/month - Exclusive content, member events




**Visual Requirements:**

- Pricing cards grid grid-cols-1 md:grid-cols-3 gap-6

- Recommended tier badge absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground rounded-full

- Member badge px-3 py-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full text-xs




## 3. Animation Specifications




**Page Transitions:**

- Fade and slide up: initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}




**Card Hover Effects:**

- Subtle lift and shadow: whileHover={{ y: -4, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}




**Dropdown Menus:**

- Slide down with fade: initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}




**Weather Icon:**

- Floating motion: animate={{ y: [-2, 2, -2] }} transition={{ duration: 3, repeat: Infinity }}




## 4. Responsive Design




**Breakpoints:**

- Desktop (1024px+): Multi-column layout with sidebar

- Tablet (768px-1023px): Two-column layout

- Mobile (<768px): Single column, hamburger menu

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://localnewss.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/019ae80a-f234-4a72-874d-c7f614292b33).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
