"""Aggregate block extracts into token scales, block frequencies and step sequences.

usage: python3 -I aggregate.py <steps.tsv> <blocks-desktop.jsonl> <blocks-mobile.jsonl> <out.json>
Writes measurements only: no third-party copy leaves this script except short
heading samples kept in a separate local-only file next to <out.json>.
"""
import json, re, sys, statistics as st
from collections import Counter, defaultdict

steps_tsv, desk_p, mob_p, out_p = sys.argv[1:5]

steps = {}
for line in open(steps_tsv):
    t, slug, i, step, url = (line.rstrip('\n').split('\t') + [''] * 5)[:5]
    if url:
        steps.setdefault(url, (t, slug, int(i), step))

def step_kind(url, step):
    s = (url.rsplit('/', 1)[-1] + ' ' + step).lower()
    for k, pat in [('thankyou', r'thank|confirm'), ('upsell', r'upsell|oto|upgrade'), ('downsell', r'downsell'),
                   ('checkout', r'checkout|order'), ('optin', r'optin|opt-in|lead|register|registration|magnet'),
                   ('sales', r'sales|ecommerce|landing|vsl|webinar')]:
        if re.search(pat, s):
            return k
    return 'other'

def load(p):
    rows = {}
    for line in open(p):
        try:
            d = json.loads(line)
        except Exception:
            continue
        if 'error' in d:
            continue
        rows[d['url']] = d
    return rows

desk, mob = load(desk_p), load(mob_p)

def lum(hexc):
    m = re.match(r'#([0-9a-f]{6})', hexc or '')
    if not m:
        return None
    r, g, b = (int(m.group(1)[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def tone(sec):
    if sec['bgImage'] == 'image':
        return 'photo'
    if sec['bgImage'] == 'gradient':
        return 'gradient'
    L = lum(sec['bg'])
    if L is None:
        return 'page'
    if L < 0.08:
        return 'dark'
    if L > 0.85:
        return 'light'
    return 'tint'

def classify(sec, idx, n, kind):
    m, c = sec['modules'], sec['cues']
    heads = sec.get('headings') or []
    htext = ' '.join(h['t'] for h in heads).lower()
    has_form = bool(sec.get('inputs')) or 'form' in m
    if idx == 0:
        if kind not in ('checkout', 'upsell', 'thankyou') and ('hosted' in m or 'video' in m):
            return 'hero+video'
        if kind == 'checkout':
            return 'checkout-hero'
        if kind == 'upsell':
            return 'upsell-hero'
        if kind == 'thankyou':
            return 'confirmation-hero'
        return 'hero+form' if has_form else 'hero'
    if 'accordion' in m or c['faq'] and re.search(r'faq|question', htext):
        return 'faq'
    if c.get('noThanks') and kind in ('upsell', 'downsell'):
        return 'upsell-decision'
    if has_form and kind == 'checkout':
        return 'checkout-form'
    if has_form:
        return 'form-card'
    if 'hosted' in m or 'video' in m:
        return 'video'
    if 'countdown' in m or re.search(r'\b(hours|minutes|seconds)\b', htext):
        return 'countdown'
    if 'video' in m:
        return 'video'
    if c['logos'] and not heads[1:]:
        return 'logo-strip'
    if c['testimonial'] or re.search(r'what .* say|testimonial|review|success stor|loved by', htext):
        return 'testimonials'
    if c['guarantee'] and re.search(r'guarantee|risk|refund', htext):
        return 'guarantee'
    if c['price'] and re.search(r'value|price|bonus|get|offer|inside|include', htext):
        return 'offer-stack'
    if c['steps'] or re.search(r'how it works|step', htext):
        return 'steps'
    if c['date'] and re.search(r'webinar|session|agenda|date|live|when', htext):
        return 'event-details'
    if re.search(r'meet|about|who (am i|we are)|instructor|host|founder|story', htext):
        return 'bio'
    if idx == n - 1 and sec['h'] < 260:
        return 'footer'
    if sec['buttons'] and sec['h'] < 560 and len(heads) <= 2:
        return 'cta-band'
    if m.get('icon-text', 0) >= 3 or m.get('icon', 0) >= 3 or (sec.get('card') or {}).get('n', 0) >= 3:
        return 'benefit-grid'
    if len(sec.get('cols') or []) >= 2 and sec['imgCount'] >= 1:
        return 'feature-split'
    return 'content'

def q(vals, ps=(0.25, 0.5, 0.75)):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    out = {}
    for p in ps:
        k = (len(vals) - 1) * p
        out[f'p{int(p * 100)}'] = round(vals[int(k)] + (vals[min(int(k) + 1, len(vals) - 1)] - vals[int(k)]) * (k - int(k)), 1)
    out['n'] = len(vals)
    return out

def px(v):
    try:
        return float(str(v).replace('px', '').split()[0])
    except Exception:
        return None

report = {'pages': 0, 'templates': len({s[1] for s in steps.values()}), 'types': Counter(s[0] for s in steps.values())}
type_sizes = defaultdict(lambda: defaultdict(list))
btn = defaultdict(list)
pads = defaultdict(list)
container = []
fonts_display, fonts_body, pairs = Counter(), Counter(), Counter()
block_counts, block_by_kind, tones, hero_tone = Counter(), defaultdict(Counter), Counter(), Counter()
first_block = Counter()
hero_feat = Counter()
cols = Counter()
cards, inputs = defaultdict(list), defaultdict(list)
sequences = []
alternation = []
samples = defaultdict(list)
page_heights = defaultdict(list)
modules_total = Counter()
cta_per_page = []
popup_fields = Counter()

for url, d in desk.items():
    t, slug, order, step = steps.get(url, ('?', '?', 0, '?'))
    kind = step_kind(url, step)
    report['pages'] += 1
    secs = d['sections']
    n = len(secs)
    page_heights[kind].append(d['pageH'])
    blocks = [classify(s, i, n, kind) for i, s in enumerate(secs)]
    sequences.append({'type': t, 'template': slug, 'order': order, 'kind': kind, 'blocks': blocks})
    for b in blocks:
        block_counts[b] += 1
        block_by_kind[kind][b] += 1
    if secs:
        hero_tone[tone(secs[0])] += 1
        h0 = secs[0]; hm = h0['modules']
        hero_feat['n'] += 1
        hero_feat['form'] += bool(h0.get('inputs')) or 'form' in hm
        hero_feat['video'] += 'hosted' in hm or 'video' in hm
        hero_feat['countdown'] += 'countdown' in hm
        hero_feat['checklist'] += hm.get('icon-text', 0) >= 2
        hero_feat['button'] += bool(h0.get('buttons'))
        hero_feat['two_columns'] += len([c for c in h0['cols'] if c < 80]) >= 2
        hs = h0.get('headings') or []
        hero_feat['eyebrow_above_h1'] += len(hs) >= 2 and hs[0]['size'] < hs[1]['size'] * 0.6
        hero_feat['center'] += bool(hs) and hs[0]['align'] == 'center'
        hero_feat['date'] += h0['cues']['date']
    ts = [tone(s) for s in secs]
    tones.update(ts)
    alternation.append(sum(1 for a, b in zip(ts, ts[1:]) if a != b) / max(1, n - 1))
    ctas = 0
    disp = body = None
    for s in secs:
        for k, v in s['modules'].items():
            modules_total[k] += v
        for h in s.get('headings') or []:
            type_sizes['desktop'][h['tag']].append(h['size'])
            type_sizes['desktop_lh'][h['tag']].append(h['lh'])
            type_sizes['desktop_weight'][h['tag']].append(int(h['weight']))
            if h['tag'] in ('H1', 'H2') and not disp:
                disp = h['family']
            if h['tt'] == 'uppercase':
                type_sizes['flags']['heading_uppercase'].append(1)
            else:
                type_sizes['flags']['heading_uppercase'].append(0)
        if s.get('body'):
            type_sizes['desktop']['body'].append(s['body']['size'])
            type_sizes['desktop_lh']['body'].append(s['body']['lh'])
            body = body or s['body']['family']
        pads['desktop'].append(s['padT'])
        pads['desktop'].append(s['padB'])
        if s['innerW'] < 1400:
            container.append(s['innerW'])
        cols['+'.join(str(round(c / 5) * 5) for c in s['cols'][:4]) or 'none'] += 1
        for b in s.get('buttons') or []:
            ctas += 1
            btn['h'].append(b['h']); btn['padX'].append(b['padX']); btn['size'].append(b['size'])
            btn['radius'].append(min(px(b['radius']) or 0, 60)); btn['pill'].append(1 if (px(b['radius']) or 0) >= b['h'] / 2 - 1 else 0)
            btn['upper'].append(1 if b['tt'] == 'uppercase' else 0)
            btn['weight'].append(int(b['weight'])); btn['shadow'].append(1 if b['shadow'] and not b['shadow'].startswith('rgba(0, 0, 0, 0) 0px 0px 0px') else 0)
            btn['hardShadow'].append(1 if b['shadow'] and re.search(r'\d+px \d+px 0px', b['shadow']) and not b['shadow'].startswith('rgba(0, 0, 0, 0)') else 0)
            btn['price'].append(1 if re.search(r'[$£€]\s?\d', b['text']) else 0)
            btn['words'].append(len(b['text'].split()))
            btn['first_person'].append(1 if re.search(r'\b(my|me|i)\b', b['text'].lower()) else 0)
            btn['yes'].append(1 if b['text'].lower().startswith('yes') else 0)
            btn['ghost'].append(1 if b['bg'] == 'transparent' else 0)
            btn['fullWidthMobile'].append(None)
        c = s.get('card')
        if c and c['n']:
            cards['radius'].append(min(px(c['radius']) or 0, 60)); cards['shadow'].append(1 if c['shadow'] and not c['shadow'].startswith('rgba(0, 0, 0, 0) 0px 0px 0px') else 0)
            cards['border'].append(1 if c['border'] else 0); cards['pad'].append(c['pad'])
        for f in s.get('inputs') or []:
            if f['type'] in ('text', 'email', 'tel', 'number', 'select-one', 'textarea'):
                inputs['h'].append(f['h']); inputs['radius'].append(min(px(f['radius']) or 0, 40))
                inputs['type'].append(f['type'])
        for h in (s.get('headings') or [])[:1]:
            samples[classify(s, secs.index(s), n, kind)].append(h['t'])
    cta_per_page.append(ctas)
    fonts_display[disp] += 1
    fonts_body[body] += 1
    pairs[f'{disp} / {body}'] += 1
    for pf in d.get('popupForms') or []:
        popup_fields[len(pf['fields'])] += 1
    if blocks:
        first_block[blocks[0]] += 1

for url, d in mob.items():
    for s in d['sections']:
        for h in s.get('headings') or []:
            type_sizes['mobile'][h['tag']].append(h['size'])
        if s.get('body'):
            type_sizes['mobile']['body'].append(s['body']['size'])
        pads['mobile'].append(s['padT']); pads['mobile'].append(s['padB'])
        for b in s.get('buttons') or []:
            btn['mobile_h'].append(b['h'])
            btn['mobile_fullwidth'].append(1 if b['w'] >= d['vw'] - 64 else 0)
        for f in s.get('inputs') or []:
            inputs['mobile_h'].append(f['h'])

out = {
    'pages_desktop': len(desk), 'pages_mobile': len(mob), 'templates': report['templates'], 'steps_by_type': dict(report['types']),
    'type_scale': {vp: {tag: q(v) for tag, v in sorted(d.items())} for vp, d in type_sizes.items() if vp in ('desktop', 'mobile', 'desktop_lh', 'desktop_weight')},
    'heading_uppercase_share': round(st.mean(type_sizes['flags']['heading_uppercase']), 2),
    'section_padding': {vp: q(v) for vp, v in pads.items()},
    'container_width': q(container), 'container_top': Counter(container).most_common(6),
    'columns': cols.most_common(14),
    'fonts_display': fonts_display.most_common(15), 'fonts_body': fonts_body.most_common(15), 'pairs': pairs.most_common(12),
    'button': {k: (q(v) if k in ('h', 'padX', 'size', 'radius', 'weight', 'words', 'mobile_h') else round(st.mean(v), 2)) for k, v in btn.items() if v and v[0] is not None},
    'card': {k: (q(v) if k in ('radius', 'pad') else round(st.mean(v), 2)) for k, v in cards.items()},
    'input': {'h': q(inputs['h']), 'mobile_h': q(inputs['mobile_h']), 'radius': q(inputs['radius']), 'types': Counter(inputs['type']).most_common()},
    'popup_form_field_counts': sorted(popup_fields.items()),
    'ctas_per_page': q(cta_per_page),
    'tones': tones.most_common(), 'hero_tone': hero_tone.most_common(), 'tone_change_rate': q(alternation),
    'page_height_by_step': {k: q(v) for k, v in page_heights.items()},
    'blocks': block_counts.most_common(), 'blocks_by_step': {k: v.most_common() for k, v in block_by_kind.items()},
    'first_block': first_block.most_common(), 'hero_features': dict(hero_feat), 'modules': modules_total.most_common(25),
    'sequences': sorted(sequences, key=lambda s: (s['type'], s['template'], s['order'])),
}
json.dump(out, open(out_p, 'w'), indent=1, default=list)
json.dump({k: v[:12] for k, v in samples.items()}, open(out_p.replace('.json', '.samples.local.json'), 'w'), indent=1)
print(json.dumps({k: out[k] for k in ('pages_desktop', 'pages_mobile', 'templates')}))
