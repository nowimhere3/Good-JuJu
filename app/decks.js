export const validDeckId=id=>typeof id==='string'&&/^(r1|personal|(?:user-)?deck-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(id);
export function availableDecks(master,personal,cards=[]){
  const list=[...master.map(d=>({...d,origin:'master'})),{id:'personal',title:'My cards',origin:'personal'},...(personal.decks||[]).map(d=>({...d,origin:'personal'}))];
  for(const id of new Set(cards.map(c=>c.deckId).filter(Boolean)))if(!list.some(d=>d.id===id))list.push({id,title:`Unavailable deck · ${id}`,origin:'unavailable'});
  return list.map(d=>({...d,title:personal.deckNames?.[d.id]||d.title}));
}
