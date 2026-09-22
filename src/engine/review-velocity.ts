export interface OutscraperReview {
  review_rating?: number | string;
  review_timestamp?: number | string;
  review_datetime_utc?: string;
  owner_answer?: string;
  owner_answer_timestamp?: number | string;
}

function reviewDate(r: OutscraperReview): Date | null {
  if (r.review_datetime_utc) { const d=new Date(r.review_datetime_utc); if(Number.isFinite(d.getTime())) return d; }
  if (r.review_timestamp !== undefined) {
    const n=Number(r.review_timestamp); if(Number.isFinite(n)){ const d=new Date(n < 1e12 ? n*1000 : n); if(Number.isFinite(d.getTime())) return d; }
  }
  return null;
}
export function summarizeReviews(reviews: OutscraperReview[], exact90d:boolean, now=new Date()) {
  const cutoff30=now.getTime()-30*86400000, cutoff90=now.getTime()-90*86400000;
  const dated=reviews.map(r=>({r,d:reviewDate(r)})).filter((x):x is {r:OutscraperReview,d:Date}=>!!x.d).sort((a,b)=>b.d.getTime()-a.d.getTime());
  const r30=dated.filter(x=>x.d.getTime()>=cutoff30), r90=dated.filter(x=>x.d.getTime()>=cutoff90);
  const low=r90.filter(x=>Number(x.r.review_rating)<=2).length, replies=r90.filter(x=>!!x.r.owner_answer).length;
  return {
    reviews30d:r30.length, reviews90d:r90.length,
    daysSinceLast:dated[0]?Math.floor((now.getTime()-dated[0].d.getTime())/86400000):null,
    lowRatingShare90d:r90.length?Math.round(low/r90.length*1000)/10:null,
    ownerReplyRate90d:r90.length?Math.round(replies/r90.length*1000)/10:null,
    exact:exact90d,
  };
}
