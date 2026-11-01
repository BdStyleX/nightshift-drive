# Nightshift Drive: আপলোড গাইড (iPhone থেকেই করা যায়)

এই ZIP-এ কোনো ফোল্ডার নেই, সব ফাইল এক সারিতে। তাই iPhone-এর Safari দিয়েই GitHub-এ আপলোড করা যায়। কোড বদলাতে হবে না, শুধু `firebase-config.js`-এ নিজের Firebase কী বসাতে হবে (ধাপ ২) আর `privacy.html`-এ ইমেইল বসাতে হবে।

## গেমে কী আছে
- ফোন যেভাবেই ধরুন গেম নিজে আড়াআড়ি হয়ে খোলে। কোনো "Rotate" মেসেজ আসে না।
- ৬টি গাড়ির রেস: আপনি আর ৫টি AI গাড়ি, ৩ ল্যাপ। স্ক্রিনে পজিশন (যেমন 3/6) দেখায়।
- ট্র্যাকে ঘুরন্ত সোনালি কয়েন। প্রতিটি কয়েন = ২৫ ক্রেডিট। রেস শেষে পজিশন অনুযায়ী বোনাস: ১ম ১৫০০, ২য় ১০০০, ৩য় ৭০০, ৪র্থ ৫০০, ৫ম ৩৫০, ৬ষ্ঠ ২৫০।
- ক্রেডিট দিয়ে ৮টি গাড়ি কেনা, রং/ফিনিশ/রিম/টায়ার বদলানো, ইঞ্জিন আপগ্রেড।
- বাঁ হাতে স্টিয়ারিং হুইল, ডানে GAS ও BRAKE। Settings → Drive controls-এ বড় তিনটি কার্ড থেকে বেছে **OK** চাপলে গেমে সেটাই আসে: **Wheel** (ডিফল্ট), **Tilt** (ফোন ডানে কাত করলে গাড়ি ডানে, বামে কাত করলে বামে), **Arrows** (বাম ও ডান দুই বোতাম)।
- Tilt চালাতে হলে গেমের লিংকে খুলতে হবে (Claude-এর প্রিভিউতে সেন্সর বন্ধ)। iPhone প্রথমবার Motion অনুমতি চাইবে, Allow দিন। রেস শুরুর কাউন্টডাউনে ফোন যেভাবে ধরা থাকে সেটাই সোজা ধরা হয়। পজ মেনুর "Centre tilt" দিয়ে আবার ঠিক করা যায়।
- মেনুর ডান কোণের গাড়ির আইকনে ট্যাপ করলে Station (কাস্টমাইজ ও ডিলারশিপ) খোলে, না খুললে পুরো স্ক্রিনে শুধু গাড়ি।
- লোডিং স্ক্রিন গেম খোলার সময় ও রেস শুরুর সময় আসে।
- মেনুর বাঁ কোণে প্রোফাইল আইকন (ও ক্রেডিট)। ট্যাপ করলে প্রোফাইল ও Gmail লগইন প্যানেল খোলে, আবার ট্যাপ করলে লুকায়।

## ফাইল তালিকা
| ফাইল | কাজ |
|---|---|
| `index.html`, `style.css`, `game.js` | গেম নিজে |
| `config.js` | গেম সেটিং (`demo:false` রাখুন) |
| `firebase-config.js` | **আপনার Firebase কী এখানে বসবে** |
| `firebase-sync.js` | Gmail লগইন ও ক্লাউড সেভ |
| `firestore.rules` | ডাটাবেস সিকিউরিটি রুল |
| `manifest.webmanifest`, `sw.js` | অ্যাপ হিসেবে ইনস্টল, অফলাইন, ল্যান্ডস্কেপ |
| `icon-*.png`, `maskable-512.png`, `apple-touch-icon.png` | অ্যাপ আইকন |
| `feature-graphic.png` | Play Store ফিচার গ্রাফিক (1024×500) |
| `privacy.html` | প্রাইভেসি পলিসি (Play Store-এ লাগবে) |
| `.nojekyll` | GitHub Pages-এর জন্য খালি ফাইল |

---

## ধাপ ১: GitHub-এ লাইভ করা (ইউজারনেম: BdStyleX)

আপনার `BdStyleX.github.io` রিপো আগে থেকেই আছে। সেটা ছুঁবেন না। গেমের জন্য **নতুন আলাদা রিপো** বানান।

1. Safari-তে https://github.com/new খুলুন (সাইন ইন থাকতে হবে)।
2. Repository name: `nightshift-drive`। **Public** রাখুন। **Create repository** চাপুন।
3. https://github.com/BdStyleX/nightshift-drive/upload/main খুলুন।
4. ZIP আনজিপ করে **সব ফাইল একসাথে** (কোনো ফোল্ডার ছাড়া) ড্র্যাগ করুন বা **choose your files** দিয়ে সিলেক্ট করুন। ফাইল: index.html, style.css, game.js, config.js, firebase-config.js, firebase-sync.js, firestore.rules, manifest.webmanifest, sw.js, privacy.html, icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png, feature-graphic.png, README.md (`.nojekyll` থাকলে ভালো, না থাকলেও চলবে)।
5. নিচে **Commit changes**।
6. https://github.com/BdStyleX/nightshift-drive/settings/pages খুলুন। Source: **Deploy from a branch**, Branch: **main**, Folder: **/ (root)**, **Save**।
7. ১-২ মিনিট পর গেমের লিংক: **https://bdstylex.github.io/nightshift-drive/**
   এই লিংকটাই সবাইকে পাঠান। যে কেউ খুলে খেলতে পারবে, কিছু ইনস্টল করতে হবে না।

**বন্ধুদের বলুন:** iPhone-এ লিংক খুলে Share → **Add to Home Screen** দিলে অ্যাপের মতো ফুলস্ক্রিনে খোলে। সমস্যা পেলে স্ক্রিনশট সহ আপনাকে জানাতে বলুন, অথবা রিপোর **Issues** ট্যাব থেকে লিখতে পারে।

**টেস্ট বিল্ড:** `config.js`-এ `demo:true` থাকায় Settings-এ "+10,000 test credits" বোতাম আছে, যাতে টেস্টাররা সব গাড়ি চালিয়ে দেখতে পারে। Play Store-এর আগে `demo:false` করুন।

**ফাইল বদলালে:** রিপোতে ফাইলটি খুলে পেন্সিল আইকন → বদলান → Commit। বড় বদলে `sw.js`-এর `nsd-v6` বাড়িয়ে `nsd-v7` করুন, নইলে পুরনো ক্যাশ দেখাতে পারে।

**পরে Play Store-এ:** `assetlinks.json` ডোমেইনের মূলে (`https://bdstylex.github.io/.well-known/assetlinks.json`) থাকতে হয়, তাই ওটা `BdStyleX.github.io` রিপোতে `.well-known/assetlinks.json` নামে রাখবেন। সাথে ঐ রিপোতে একটা খালি `.nojekyll` ফাইল দিন।

---

## ধাপ ২: Firebase (Gmail লগইন ও ক্লাউড সেভ)

1. console.firebase.google.com → **Add project**।
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, সাপোর্ট ইমেইল দিন, Save।
3. **Authentication → Settings → Authorized domains → Add domain**: `আপনার-ইউজারনেম.github.io`।
4. **Build → Firestore Database → Create database** (Production mode)।
5. Firestore-এর **Rules** ট্যাবে `firestore.rules`-এর সব লেখা পেস্ট করে **Publish**।
6. **Project settings (গিয়ার) → Your apps → Web (`</>`)** → অ্যাপ রেজিস্টার → `firebaseConfig`-এর মান কপি।
7. GitHub-এ `firebase-config.js` খুলে `YOUR_...` লেখাগুলোর জায়গায় মানগুলো বসান, Commit।
8. গেমে **LOGIN WITH GMAIL** চাপুন। সফল হলে নাম ও ছবি আসবে। অন্য ফোনে একই Gmail দিয়ে ঢুকলে গাড়ি ও ক্রেডিট ফিরে আসবে।

**ডাটাবেস কাঠামো**
```
users/{uid}                  name, credits, sel, stats{races, best{carId: ms}}, photo, updatedAt
users/{uid}/cars/{carId}     carId = kite | ridge | dhaka | metro | volt | reight | bull | phantom
                             paint, fin, glow, rim, tire, unl{rim[], tire[]}, eng{speed, accel, handling}
```
সীমাবদ্ধতা: ক্রেডিট ও কেনাকাটার হিসাব ফোনের ভেতরে হয়, তাই কেউ চাইলে নিজের ক্রেডিট বাড়াতে পারে। আসল টাকা জড়িত না থাকলে শুরুতে সমস্যা নেই। পরে সার্ভারে যাচাই বসাতে Cloud Functions লাগবে (Firebase Blaze প্ল্যান)।

---

## ধাপ ৩: Play Store-এর জন্য .aab বানানো

**আগে:**
- Google Play Developer অ্যাকাউন্ট (এককালীন ফি)।
- `privacy.html`-এর শেষে `YOUR-EMAIL@example.com` বদলে নিজের ইমেইল দিন।
- গাড়ির নামে Honda, Jeep, BMW ইত্যাদি বা লোগো ব্যবহার করবেন না। এই গেমের সব নাম কাল্পনিক।

**বানানো (iPhone Safari-তেই হয়):**
1. pwabuilder.com খুলে গেমের লিংক (`https://আপনার-ইউজারনেম.github.io/`) দিয়ে **Start** চাপুন। Manifest ও Service Worker সবুজ হওয়া উচিত।
2. **Package for stores → Android → Generate package** (Google Play)।
3. অপশনে:
   - Package ID: `com.আপনার.nightshiftdrive` (ইংরেজি ছোট হাতের অক্ষর, পরে বদলানো যায় না)
   - **Display mode: Fullscreen**
   - **Orientation: Landscape**
   - Signing key: **New**
4. Generate করে ZIP নামান। ভেতরে `.aab` ফাইল, `signing.keystore`, `signing-key-info.txt` ও `assetlinks.json` থাকবে। সম্ভব হলে একটা `.apk`-ও থাকে, ওটা সরাসরি Android ফোনে টেস্টের জন্য।
5. **keystore ফাইল ও পাসওয়ার্ড নিরাপদ জায়গায় ব্যাকআপ রাখুন।** হারালে অ্যাপ আপডেট করা যাবে না।
6. GitHub-এ **Add file → Create new file**, নামের ঘরে লিখুন `.well-known/assetlinks.json`, পাওয়া ফাইলের লেখা পেস্ট করে Commit। (এটাই অ্যাড্রেস বার লুকিয়ে অ্যাপকে পুরো স্ক্রিন করে।) Play Console-এ অ্যাপ আপলোডের পর "App signing" পাতায় Google-এর নিজস্ব SHA-256 দেখাবে, ওটাও `assetlinks.json`-এ যোগ করতে হবে।
7. অরিয়েন্টেশন: ZIP-এর সোর্সে `AndroidManifest.xml`-এ `android:screenOrientation="sensorLandscape"` থাকলে অ্যাপ সবসময় আড়াআড়ি থাকে এবং দুই দিকেই ঘোরে। PWABuilder-এ Landscape দিলে সাধারণত এটাই বসে।

**Play Console চেকলিস্ট** (play.google.com/console, Safari-তে "Request Desktop Website" দিলে সহজ)
- [ ] Create app: Game, Free
- [ ] Internal testing-এ `.aab` আপলোড, নিজের Android ফোনে পরীক্ষা
- [ ] App icon 512×512: `icon-512.png`
- [ ] Feature graphic: `feature-graphic.png`
- [ ] ফোনের কমপক্ষে ২টি স্ক্রিনশট (আপনার ফোনে খেলতে খেলতে তুলুন)
- [ ] Privacy policy URL: `https://আপনার-ইউজারনেম.github.io/privacy.html`
- [ ] Data safety ফর্ম: Name, Email, Profile photo (Google সাইন-ইন), Game progress (ক্লাউড সেভ); ডাটা এনক্রিপ্টেড ট্রানজিটে; মুছে ফেলার অনুরোধ করা যায়
- [ ] Content rating প্রশ্নমালা, Ads: নেই
- [ ] নতুন পার্সোনাল অ্যাকাউন্টে Production-এর আগে Closed testing-এ নির্দিষ্ট সংখ্যক টেস্টার নির্দিষ্ট দিন লাগতে পারে। সংখ্যা Play Console সাহায্য পাতায় দেখে নিন, নিয়ম বদলায়।
- [ ] Target API লেভেল Google-এর বর্তমান শর্ত অনুযায়ী (PWABuilder সাধারণত নতুনটাই দেয়)

---

## স্ক্রিন ঘোরানো নিয়ে যা জানা দরকার
- **ওয়েব লিংকে (iPhone ও Android):** পোর্ট্রেটে খুললে গেম নিজে ৯০° ঘুরে আড়াআড়ি দেখায়। ফোন ঘোরালে স্বাভাবিক আড়াআড়ি মোডে চলে যায়। উল্টো দিকে দেখলে Settings → Flip screen চালু করুন।
- **ফুলস্ক্রিন:** iPhone Safari-তে ব্রাউজারের ফুলস্ক্রিন নেই। Share → **Add to Home Screen** দিলে অ্যাপের মতো ফুলস্ক্রিনে খুলবে। Android Chrome-এ প্রথম ট্যাপে ফুলস্ক্রিন হয়।
- **Play Store অ্যাপ:** ম্যানিফেস্টের লক থাকায় সবসময় আড়াআড়ি।

## অফলাইন প্লে (ঐচ্ছিক)
গেম three.js কে CDN থেকে নেয়। অফলাইনেও চালাতে চাইলে three.js r128-এর `three.min.js` ফাইলটি রিপোতে `lib/three.min.js` নামে যোগ করুন (GitHub-এ Create new file দিয়ে `lib/three.min.js` লিখে)। CDN না পেলে গেম নিজে ওটা ব্যবহার করবে।

## কন্ট্রোল
ফোন: বাঁ হাতে হুইল ঘোরান, ডানে GAS/BRAKE। কীবোর্ড: W A S D বা তীর, Space ড্রিফট, R রিসেট, P পজ।
