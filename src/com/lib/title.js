export async function loadPageTitle(path = './title.txt') {
  try{
    const res = await fetch(path, {cache: 'no-store'});
    if(res.ok){
      const title = (await res.text()).trim();
      if(title){
        document.title = title;
      }

      const h1 = document.querySelector('#pageTitle');
      if (h1) h1.textContent = title;

    }
  }catch (err){
    console.log( err);
  }
}