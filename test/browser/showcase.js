const docs = new URLSearchParams(location.search).get("page") === "document";
const news = `<header><b>Y</b> Community news <small>new · comments · ask · show</small></header><ol>
<li>Building a quieter corner of the web <small>(example.org)</small><p>128 points · 42 comments</p></li>
<li>A field guide to small software <small>(example.net)</small><p>96 points · 18 comments</p></li>
<li>Show: a tiny tool for late-night reading <small>(example.com)</small><p>74 points · 23 comments</p></li>
<li>What are you making this weekend?<p>51 points · 35 comments</p></li>
<li>The joy of useful defaults<p>39 points · 12 comments</p></li></ol><footer>Guidelines · FAQ · Search</footer>`;
const documentPage = '<h2>Notes for a calmer workspace</h2><canvas class="kix-canvas-tile-content" width="530" height="280"></canvas>';
for (const enabled of [false, true]) {
  const article = document.createElement("article");
  article.innerHTML = `<h2>${enabled ? "Nightshade on" : "Original page"}</h2>`;
  const frame = document.createElement("iframe"); frame.title = enabled ? "Nightshade on" : "Original page";
  article.append(frame); document.getElementById("comparison").append(article);
  frame.srcdoc = `<!doctype html><html><head><style>
    body{margin:${docs ? '0' : '20px'};background:${docs ? '#fff' : '#f6f6ef'};color:#151515;font:15px Arial}header{padding:10px;background:#ff6600}header b{border:1px solid white;padding:2px 6px}small{font-size:11px}ol{padding-left:32px}li{padding:6px 0}p{color:#777;font-size:12px;margin:6px 0}footer{border-top:2px solid #f60;text-align:center;padding:15px;font-size:12px}h2{font-size:23px;margin:28px}canvas{margin:0 28px}
    </style><link rel="stylesheet" href="/src/content.css"></head><body>${docs ? documentPage : news}
    <script>window.chrome={storage:{sync:{get:async()=>({globalEnabled:${enabled},dim:0,preserveMedia:true,sites:{}})},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}}}};<\/script>
    <script src="/src/media.js"><\/script>
    ${docs ? `<script>
      const create=NightshadeMedia.createController;NightshadeMedia.createController=(doc)=>create(doc,'docs.google.com','/document/d/synthetic/preview');
      const c=document.querySelector('canvas').getContext('2d');c.font='17px Arial';c.fillText('Good defaults should disappear into the background.',0,25);c.fillText('• Keep text readable.',0,65);c.fillText('• Leave existing dark themes alone.',0,97);c.fillText('• Make exceptions easy to undo.',0,129);c.fillStyle='#f0f2f3';c.fillRect(0,160,530,100);c.fillStyle='#16753b';c.font='16px monospace';c.fillText('theme = page.isDark ? original : nightshade',14,197);c.fillText('photos.preserveColors = true',14,230);
    <\/script>` : ''}
    <script src="/src/content.js"><\/script></body></html>`;
}
