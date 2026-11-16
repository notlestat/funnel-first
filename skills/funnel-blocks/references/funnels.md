# Funnel types and step order

The study covered nine funnel types. Below is the step order each type used, then the block order inside each step. Block names match `blocks.md`.

## Steps per funnel type

| Type | Steps in the study | Templates | `funnel-first` recipe |
|---|---|---|---|
| Lead generation | Opt-in → Thank you (one adds a booking step) | 11 | `appointment` or `lead-magnet` |
| Lead magnet | Opt-in → Thank you | 7 | `lead-magnet` |
| Webinar | Registration → Thank you (one sells a paid workshop: → Order → Upsell → Thank you) | 7 | `webinar` |
| Sales | Sales → Checkout → Thank you | 10 | not in system |
| Video sales letter | Sales (video) → Checkout → Upsell (→ Downsell) → Thank you | 5 | `vsl` covers the first step only |
| Value ladder | Free opt-in → Low-price offer → Checkout → Upsell (→ Downsell) → Thank you | 4 | not in system |
| Tripwire | Low-price sales → Upsell → Thank you | 1 | not in system |
| Cross-sell | Product page → Checkout → Thank you | 1 | not in system |
| Daily deal | Product page → Order → Thank you | 2 | not in system |

The conversion system's five recipes cover the free first steps. Everything from the checkout on belongs to the backend today.

## Block order inside each step

`→` separates blocks. `( )` means optional. `×2` means the block often appears twice.

### Opt-in step (lead generation, lead magnet)

```
Brand bar → Hero (stacked, photo or split with form)
→ Benefit grid → Feature split ×2 → (Testimonials) → (Bio)
→ Benefit grid → FAQ → CTA band or Form card
```

- 6 to 8 blocks, about 6,000px on desktop.
- The hero carries the form on a fifth of front pages. When it does not, every button opens a two-field pop-up form.
- FAQ second to last, then the ask again.

### Sales step (sales, video sales letter, value ladder, tripwire)

```
(Announcement bar) → Brand bar → Hero (video or stacked, price in the button)
→ (Testimonials or Rating stack) → Benefit grid → Feature split
→ Bio → Benefit grid ×2 → Video → Testimonials
→ Offer stack → (Countdown) → FAQ → Guarantee → CTA band or Form card
```

- 8 to 14 blocks, about 7,700px on desktop. The longest step.
- Same frame as the opt-in, with three additions before the close: the host bio, the offer stack and the guarantee.
- Value-ladder pages put the countdown inside or right above the offer stack.

### Webinar registration

```
Brand bar → Hero (event: date and time chips, countdown, or split with form)
→ Benefit grid ("What you will learn") → Feature split or Bio
→ Video (replay or trailer) → FAQ → Form card or Countdown
```

- 6 to 8 blocks. The countdown appears at the top, the bottom, or both.

### Product page (cross-sell, daily deal)

```
(Announcement bar) → Brand bar → Hero (product, price in the button)
→ Testimonials → (Logo strip) → Benefit grid → Offer stack
→ Benefit grid → Video → Feature split → CTA band
```

### Checkout

```
Brand bar → Checkout (progress, step tabs, product row, fields, order bump, pay button)
→ (Guarantee) → (CTA band)
```

- One tall section in 7 of 22 checkouts with nothing after it. 32% add a guarantee.

### Upsell and downsell

```
Brand bar → Upsell hero (step pill, "your order is not complete", video, was / now price)
→ (Benefit grid) → Decision (yes button, plain no link)
```

- About 2,300px. The downsell has the same shape with a smaller offer.

### Thank you

```
Brand bar → Confirmation (check, what happened, next steps)
→ (Benefit grid, Bio or Steps) → Footer
```

- About 1,100px. The shortest step. On webinars the next steps are the calendar invite and the joining link.

## Choosing the step's first ask

| The visitor is | First ask | Block |
|---|---|---|
| Cold, on a phone, low commitment | A button that opens a two-field pop-up form | Hero stacked or photo + pop-up `fb-formcard` |
| Warm, already knows the offer | The form on screen one | Hero split with form |
| Needs persuading first | Watch, then the button under the video | Hero video |
| Booking a dated session | A button that names the date | Hero event |
| Already bought | One yes or one no | Upsell |

For quiz and appointment funnels with qualifying questions, use the conversion system's `question` hero and `flow`. The studied templates never did this, so this library has no block for it.
