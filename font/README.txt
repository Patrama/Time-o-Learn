This page currently loads its fonts (Fraunces + Work Sans) from
Google Fonts via the <link> tags in index.html — no local font
files are required for it to work.

If you'd rather self-host the fonts (e.g. for offline use or
faster loading):
1. Download the .woff2 files for Fraunces and Work Sans and place
   them in this /fonts folder.
2. Add an @font-face rule at the top of css/style.css pointing to
   them, e.g.:

   @font-face {
     font-family: 'Fraunces';
     src: url('../fonts/Fraunces.woff2') format('woff2');
   }

3. Remove the Google Fonts <link> tags from index.html.
