import { OutscraperRecord } from '../types/outscraper';
import { ScoredCompetitor } from './relevance';
import { formatBenchmarkRank } from '../reports/rankings';

export interface MetricStats {
  n: number; subject: number | null; median: number | null; p75: number | null;
  nearest5Median: number | null; max: number | null; rank: number | null; of: number;
}
export interface BenchmarkData {
  totalCandidates:number; includedCount:number; excludedCount:number;
  competitorsWithWebsites:number; competitorsWithoutWebsites:number; websiteValidationSummary:string;
  avgRating:number|null; avgReviews:number|null; avgPhotos:number|null;
  medianRating:number|null; medianReviews:number|null; medianPhotos:number|null;
  p75Rating:number|null; p75Reviews:number|null; p75Photos:number|null;
  nearest5MedianRating:number|null; nearest5MedianReviews:number|null; nearest5MedianPhotos:number|null;
  maxRating:number|null; maxReviews:number|null; maxPhotos:number|null;
  percentWithHours:number|null; percentWithDescription:number|null;
  subjectRatingRank:number|null; subjectReviewRank:number|null; subjectPhotoRank:number|null;
  subjectRatingRankLabel:string; subjectReviewRankLabel:string; subjectPhotoRankLabel:string;
  ratingStats:MetricStats; reviewStats:MetricStats; photoStats:MetricStats;
  benchmarkConfidence:number; confidenceReasons:string[]; constraints:string[];
}
const parseNum=(v:number|string|undefined):number|null=>{if(v===undefined||v===null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const avg=(a:number[])=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
const quantile=(a:number[],q:number):number|null=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),p=(s.length-1)*q,b=Math.floor(p),r=p-b;return Math.round((s[b]+(s[b+1]!==undefined?r*(s[b+1]-s[b]):0))*10)/10};
const rank=(v:number|null,p:number[])=>v===null?null:p.filter(x=>x>v).length+1;
const dist=(a:OutscraperRecord,b:OutscraperRecord)=>{if(a.latitude==null||a.longitude==null||b.latitude==null||b.longitude==null)return Infinity;const R=6371,rad=(x:number)=>x*Math.PI/180,dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude),x=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
function nearestValues(subject:OutscraperRecord|null, included:ScoredCompetitor[], key:'rating'|'reviews'|'photos_count'):number[]{if(!subject)return[];return [...included].sort((a,b)=>dist(subject,a.record)-dist(subject,b.record)).slice(0,5).map(c=>parseNum(c.record[key] as any)).filter((n):n is number=>n!==null)}
function stats(subjectValue:number|null,pop:number[],nearest:number[]):MetricStats{const r=rank(subjectValue,pop);return{n:pop.length,subject:subjectValue,median:quantile(pop,.5),p75:quantile(pop,.75),nearest5Median:quantile(nearest,.5),max:pop.length?Math.max(...pop):null,rank:r,of:pop.length+1}}
export function computeBenchmarks(subject:OutscraperRecord|null,scored:ScoredCompetitor[]):BenchmarkData{
 const included=scored.filter(c=>c.included), excludedCount=scored.length-included.length;
 const ratings=included.map(c=>parseNum(c.record.rating)).filter((n):n is number=>n!==null),reviews=included.map(c=>parseNum(c.record.reviews)).filter((n):n is number=>n!==null),photos=included.map(c=>parseNum(c.record.photos_count)).filter((n):n is number=>n!==null);
 const sr=subject?parseNum(subject.rating):null, sv=subject?parseNum(subject.reviews):null, sp=subject?parseNum(subject.photos_count):null;
 const ratingStats=stats(sr,ratings,nearestValues(subject,included,'rating')),reviewStats=stats(sv,reviews,nearestValues(subject,included,'reviews')),photoStats=stats(sp,photos,nearestValues(subject,included,'photos_count'));
 const withWebsites=included.filter(c=>c.hasValidWebsite).length,withHours=included.filter(c=>c.record.working_hours).length,withDesc=included.filter(c=>c.record.description).length;
 let confidence=100;const reasons:string[]=[];if(included.length===0){confidence=0;reasons.push('No relevant competitors could be identified')}else if(included.length<8){confidence-=30;reasons.push('Fewer than 8 relevant competitors after filtering')}else if(included.length<12){confidence-=12;reasons.push('Moderate competitor sample size')}
 const weak=included.filter(c=>c.relevanceScore<70).length;if(weak){confidence-=Math.min(20,weak*3);reasons.push(weak+' included competitors have relevance below 70')}
 confidence=Math.max(0,Math.min(100,confidence));
 const totalPopulation=included.length+1;
 const constraints=[
  `VALIDATED SET: ${included.length} competitors; subject is separate; ranking population is ${totalPopulation}.`,
  `BENCHMARK RULE: Use median/P75/nearest-5 as actionable comparisons. Maximum values are context only, never recommended targets.`,
  `VISIBILITY RULE: Geographic map/pack visibility is not measured in this run and must not be claimed.`
 ];
 return{
  totalCandidates:scored.length,includedCount:included.length,excludedCount,
  competitorsWithWebsites:withWebsites,competitorsWithoutWebsites:included.length-withWebsites,websiteValidationSummary:`Competitors analysed: ${included.length} | With websites: ${withWebsites} | Without websites: ${included.length-withWebsites}`,
  avgRating:avg(ratings),avgReviews:avg(reviews),avgPhotos:avg(photos),
  medianRating:ratingStats.median,medianReviews:reviewStats.median,medianPhotos:photoStats.median,
  p75Rating:ratingStats.p75,p75Reviews:reviewStats.p75,p75Photos:photoStats.p75,
  nearest5MedianRating:ratingStats.nearest5Median,nearest5MedianReviews:reviewStats.nearest5Median,nearest5MedianPhotos:photoStats.nearest5Median,
  maxRating:ratingStats.max,maxReviews:reviewStats.max,maxPhotos:photoStats.max,
  percentWithHours:included.length?Math.round(withHours/included.length*100):null,percentWithDescription:included.length?Math.round(withDesc/included.length*100):null,
  subjectRatingRank:ratingStats.rank,subjectReviewRank:reviewStats.rank,subjectPhotoRank:photoStats.rank,
  subjectRatingRankLabel:formatBenchmarkRank(ratingStats.rank,included.length),subjectReviewRankLabel:formatBenchmarkRank(reviewStats.rank,included.length),subjectPhotoRankLabel:formatBenchmarkRank(photoStats.rank,included.length),
  ratingStats,reviewStats,photoStats,benchmarkConfidence:confidence,confidenceReasons:reasons,constraints
 };
}
