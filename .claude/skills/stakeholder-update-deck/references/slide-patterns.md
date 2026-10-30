# Slide patterns

The slides from the first deck this skill made (Ezzy Booker launch, Oct 24–29, 2026). They
are known to fit the Slides type's format and to read well. Copy the markup for the slide kind
you need, then change the words. Replace the logo `src` with the `/_blob/<id>` url your own
asset upload returns — the one below belongs to the original deck.

Palette: dark `#0b1020`, light `#f6f8fc`, accent `#034bfc`, body on light `#4a5568`, body on
dark `#c9d3ea` / `#dfe5f4`, accent on dark `#8fb0ff`. Type scale: 120 / 72 / 40 / 30–34 / 28.
Rhythm: cover and "how we checked" and recap on dark, headline on accent, the rest on light.

Index used (`project/deck.json`):

```json
{"v":4,"createdOnFiles":{"v":1,"at":"2026-10-29T18:00:00Z"},"lists":"css","title":"Ezzy Booker — Launch Update","order":["cover","live","built","home","tested","timeline","next","close"],"sections":{"s1":{"description":"Where we are: Ezzy Booker is live","start":"cover"},"s2":{"description":"What we built and improved since Saturday, October 24","start":"built"},"s3":{"description":"How we checked it before going live","start":"tested"},"s4":{"description":"What happens over the next few days","start":"next"}},"faces":{"poppins":{"family":"Poppins","href":"https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"}}}
```

## `cover`

```html
<section id="cover" data-transition="fade" style="background:#0b1020;color:#f4f6fb;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:center;gap:40px">
<img src="/_blob/89edc74e0692c0880e6bd2bca94252c2" alt="Ezzy logo" style="width:144px;height:144px;object-fit:contain;border-radius:32px">
<p style="font-size:32px;font-weight:600;color:#8fb0ff;letter-spacing:4px;text-transform:uppercase">Progress update · October 24 – 29, 2026</p>
<h1 style="font-size:120px;font-weight:700;line-height:1.05;color:#f4f6fb">Ezzy Booker is live</h1>
<p style="font-size:44px;line-height:1.35;color:#c9d3ea;width:1300px">What we finished this week, and what comes next</p>
<aside>Today’s update covers the work since Saturday, October 24. The short version: the Ezzy Booker app, the website where customers find and book services, is now live for the public.</aside>
</section>
```

## `live`

```html
<section id="live" data-transition="fade" style="background:#034bfc;color:#f4f6fb;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:center;gap:48px">
<p style="font-size:32px;font-weight:600;color:#dbe5ff;letter-spacing:4px;text-transform:uppercase">The headline</p>
<h1 style="font-size:120px;font-weight:700;line-height:1.05">Live for customers since October 29</h1>
<p style="font-size:44px;line-height:1.35;color:#eef2ff;width:1400px">Customers can now sign up, find a service, book a time and pay, all at <b>booker.ezzy.ph</b></p>
<aside>We have been building the Booker app for several months. This week we finished the last pieces, checked everything, and switched it on for the public on Thursday, October 29.</aside>
</section>
```

## `built`

```html
<section id="built" data-transition="fade" style="background:#f6f8fc;color:#0b1020;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;gap:64px">
<div style="display:flex;flex-direction:column;gap:16px">
<p style="font-size:28px;font-weight:600;color:#034bfc;letter-spacing:4px;text-transform:uppercase">Since Saturday, October 24</p>
<h2 style="font-size:72px;font-weight:700;line-height:1.1">What we finished this week</h2>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
<div style="display:flex;flex-direction:column;gap:12px;background:#ffffff;padding:40px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:40px;font-weight:600">Promotional banners</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">The home page now shows rotating banners for events and partner offers</p>
</div>
<div style="display:flex;flex-direction:column;gap:12px;background:#ffffff;padding:40px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:40px;font-weight:600">A cleaner home page</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">New icons for each service category and a tidier layout on phones</p>
</div>
<div style="display:flex;flex-direction:column;gap:12px;background:#ffffff;padding:40px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:40px;font-weight:600">Email notifications</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Customers get email updates from Ezzy Booker</p>
</div>
<div style="display:flex;flex-direction:column;gap:12px;background:#ffffff;padding:40px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:40px;font-weight:600">One Ezzy look</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Old names removed; the Ezzy name and colours used throughout</p>
</div>
</div>
<aside>Four visible improvements this week. Banners let us promote events and partners right on the home page. The home page got clearer category icons and works better on phones. Customers now receive email notifications. And we cleaned up leftover old names so everything says Ezzy.</aside>
</section>
```

## `home`

```html
<section id="home" data-transition="fade" style="background:#f6f8fc;color:#0b1020;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;gap:64px">
<div style="display:flex;flex-direction:column;gap:16px">
<p style="font-size:28px;font-weight:600;color:#034bfc;letter-spacing:4px;text-transform:uppercase">For customers</p>
<h2 style="font-size:72px;font-weight:700;line-height:1.1">Safer accounts, smoother sign-up</h2>
</div>
<div style="display:flex;gap:32px">
<div style="flex:1;display:flex;flex-direction:column;gap:16px;background:#ffffff;padding:48px;border:1px solid #dfe5f1;border-radius:24px">
<x-icon name="Lock" style="color:#034bfc;width:64px;height:64px"></x-icon>
<h3 style="font-size:40px;font-weight:600">Stronger passwords</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Passwords must be at least 8 characters, and common, easy-to-guess ones are refused</p>
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:16px;background:#ffffff;padding:48px;border:1px solid #dfe5f1;border-radius:24px">
<x-icon name="Key" style="color:#034bfc;width:64px;height:64px"></x-icon>
<h3 style="font-size:40px;font-weight:600">Password reset</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Customers who forget their password can reset it by email</p>
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:16px;background:#ffffff;padding:48px;border:1px solid #dfe5f1;border-radius:24px">
<x-icon name="Home" style="color:#034bfc;width:64px;height:64px"></x-icon>
<h3 style="font-size:40px;font-weight:600">Add to home screen</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">On a phone, the site can be saved like an app, with the Ezzy name and colours</p>
</div>
</div>
<aside>Alongside the visible changes, we tightened account safety before opening to the public: stronger password rules, a working password reset, and the site saves to a phone’s home screen with the right Ezzy name and colour.</aside>
</section>
```

## `tested`

```html
<section id="tested" data-transition="fade" style="background:#0b1020;color:#f4f6fb;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;gap:64px">
<div style="display:flex;flex-direction:column;gap:16px">
<p style="font-size:28px;font-weight:600;color:#8fb0ff;letter-spacing:4px;text-transform:uppercase">Before going live</p>
<h2 style="font-size:72px;font-weight:700;line-height:1.1">We tried everything on a practice copy first</h2>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px 64px">
<div style="display:flex;gap:24px;align-items:center"><x-icon name="CheckCircle" style="color:#8fb0ff;width:56px;height:56px"></x-icon><p style="font-size:34px;line-height:1.35;color:#dfe5f4">Checked on computers, Android and iPhone</p></div>
<div style="display:flex;gap:24px;align-items:center"><x-icon name="CheckCircle" style="color:#8fb0ff;width:56px;height:56px"></x-icon><p style="font-size:34px;line-height:1.35;color:#dfe5f4">Signed up and received email notifications</p></div>
<div style="display:flex;gap:24px;align-items:center"><x-icon name="CheckCircle" style="color:#8fb0ff;width:56px;height:56px"></x-icon><p style="font-size:34px;line-height:1.35;color:#dfe5f4">Made a test booking and payment</p></div>
<div style="display:flex;gap:24px;align-items:center"><x-icon name="CheckCircle" style="color:#8fb0ff;width:56px;height:56px"></x-icon><p style="font-size:34px;line-height:1.35;color:#dfe5f4">Vendor was notified of the booking</p></div>
<div style="display:flex;gap:24px;align-items:center"><x-icon name="CheckCircle" style="color:#8fb0ff;width:56px;height:56px"></x-icon><p style="font-size:34px;line-height:1.35;color:#dfe5f4">Password reset worked from start to finish</p></div>
<div style="display:flex;gap:24px;align-items:center"><x-icon name="CheckCircle" style="color:#8fb0ff;width:56px;height:56px"></x-icon><p style="font-size:34px;line-height:1.35;color:#dfe5f4">Re-checked the live site after launch</p></div>
</div>
<aside>Every change went to a private practice copy of the site first. We tested on desktop and on real phones, signed up, booked and paid in test mode, and confirmed the vendor got notified. Only then did we move the exact same version to the live site, and checked it again there.</aside>
</section>
```

## `timeline`

```html
<section id="timeline" data-transition="fade" style="background:#f6f8fc;color:#0b1020;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;gap:80px">
<div style="display:flex;flex-direction:column;gap:16px">
<p style="font-size:28px;font-weight:600;color:#034bfc;letter-spacing:4px;text-transform:uppercase">The week at a glance</p>
<h2 style="font-size:72px;font-weight:700;line-height:1.1">Six days from banners to launch</h2>
</div>
<div style="display:flex;gap:24px">
<div style="flex:1;display:flex;flex-direction:column;gap:16px;border-top:8px solid #034bfc;padding:32px 0 0 0">
<p style="font-size:32px;font-weight:700;color:#034bfc">Sat, Oct 24</p>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Promotional banners added to the home page</p>
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:16px;border-top:8px solid #034bfc;padding:32px 0 0 0">
<p style="font-size:32px;font-weight:700;color:#034bfc">Oct 25 – 27</p>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Home page refresh and Ezzy naming clean-up</p>
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:16px;border-top:8px solid #034bfc;padding:32px 0 0 0">
<p style="font-size:32px;font-weight:700;color:#034bfc">Wed, Oct 28</p>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Email notifications, banner polish and final checks</p>
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:16px;border-top:8px solid #0b1020;padding:32px 0 0 0">
<p style="font-size:32px;font-weight:700;color:#0b1020">Thu, Oct 29</p>
<p style="font-size:30px;line-height:1.4;color:#4a5568"><b>Ezzy Booker goes live</b></p>
</div>
</div>
<aside>A quick walk through the week: banners on Saturday, the home page refresh over the weekend and Monday, email notifications and final testing on Wednesday, and launch on Thursday.</aside>
</section>
```

## `next`

```html
<section id="next" data-transition="fade" style="background:#f6f8fc;color:#0b1020;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;gap:56px">
<div style="display:flex;flex-direction:column;gap:16px">
<p style="font-size:28px;font-weight:600;color:#034bfc;letter-spacing:4px;text-transform:uppercase">Next few days</p>
<h2 style="font-size:72px;font-weight:700;line-height:1.1">Small behind-the-scenes fixes, no new features</h2>
</div>
<div style="display:flex;flex-direction:column;gap:24px">
<div style="display:flex;flex-direction:column;gap:8px;background:#ffffff;padding:36px 48px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:36px;font-weight:600">Keeping time slots free</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">A daily check releases slots held by bookings that were never paid. First check: nothing to release</p>
</div>
<div style="display:flex;flex-direction:column;gap:8px;background:#ffffff;padding:36px 48px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:36px;font-weight:600">One real paid booking</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">We’ll make a small real booking on the live site to confirm payments go through end to end</p>
</div>
<div style="display:flex;flex-direction:column;gap:8px;background:#ffffff;padding:36px 48px;border:1px solid #dfe5f1;border-radius:24px">
<h3 style="font-size:36px;font-weight:600">Philippine time, always</h3>
<p style="font-size:30px;line-height:1.4;color:#4a5568">Making sure sessions that have already passed can’t be booked by someone whose device is set to another time zone</p>
</div>
</div>
<aside>The launch is done. Over the next couple of days I’ll be tidying up a few things customers mostly won’t notice. None of these are new features.</aside>
</section>
```

## `close`

```html
<section id="close" data-transition="fade" style="background:#0b1020;color:#f4f6fb;font-family:'Poppins', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:center;gap:40px">
<img src="/_blob/89edc74e0692c0880e6bd2bca94252c2" alt="Ezzy logo" style="width:112px;height:112px;object-fit:contain;border-radius:24px">
<h1 style="font-size:96px;font-weight:700;line-height:1.1">In short</h1>
<div style="display:flex;flex-direction:column;gap:20px">
<p style="font-size:40px;line-height:1.4;color:#dfe5f4"><span style="color:#8fb0ff">●</span>  Ezzy Booker is live at booker.ezzy.ph</p>
<p style="font-size:40px;line-height:1.4;color:#dfe5f4"><span style="color:#8fb0ff">●</span>  This week added banners, a cleaner home page and email notifications</p>
<p style="font-size:40px;line-height:1.4;color:#dfe5f4"><span style="color:#8fb0ff">●</span>  Next few days: small fixes customers won’t notice</p>
</div>
<p style="font-size:32px;color:#8fb0ff;font-weight:600">Questions?</p>
<aside>To wrap up: Booker is live, this week’s work was the final polish before launch, and the next few days are quiet clean-up rather than new features. Happy to take questions.</aside>
</section>
```
