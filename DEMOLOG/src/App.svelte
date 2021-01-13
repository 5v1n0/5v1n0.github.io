<script>
	import { fade, fly, draw, scale, slide } from "svelte/transition";
	import { flip } from "svelte/animate";
	import { beforeUpdate, afterUpdate } from "svelte";
	import { tweened } from "svelte/motion";
	import { cubicOut, quintOut } from "svelte/easing";

	// Interface show/hide booleans
	let visible = false;
	let showDetail = false;
	let showSongs = false;
	let showSwatch = false;
	let showOverheadChords = false;
	let showRightInnerLeft = true;
	let error = false;
	let intro = true;
	let help = false;
	let readyToNodeWheel = false;
	let loadedCoords = false;


	let index = 0; // page load, default index
	let max = 5; // how many pages there are

	let navImg = "./img/UI/pg"+index+".png";
	let navLabel = "dEmoLog";

	

	let HomeArr = ["Avatar", "Inventory", "Grimoire"];
	let BeastArr = ["Lore", "Select", "Unlock"];
	let VentArr = ["Emotion Tomes", "Vanquish", "Loots"];
	let RecordsArr = ["Calendar"];
	let CompArr = ["-WIP-"];
	

		//UI ELEMENTS//////////
	$: {
		
		//navImg;
	}

	function toggleTutorial() {
	  toggleGif = 0;
	  currTut = 0;
	  if (help === false) {
	    help = true;
	  } else {
	    help = false;
	  }
	}
	let toggleGif = 0;
	let currTut = 0;
	function toggleGifBlinder(target) {
	  if (target === currTut) {
	    toggleGif = 0;
	    currTut = 0;
	  } else {
	    currTut = target;
	    toggleGif = target;
	  }
	}
	function pingTutorialIn() {
	  document.getElementById("tutBtn").style.background = "#026670";
	  document.getElementById("tutBtn").style.color = "white";

	  document.getElementById("pingSource").style.color = "#026670";
	  document.getElementById("pingSource").style.cursor = "default";
	}
	function pingTutorialOut() {
	  document.getElementById("tutBtn").style.background = "#EDEAE5";
	  document.getElementById("tutBtn").style.color = "rgb(173,170,165)";

	  document.getElementById("pingSource").style.color = "rgb(173,170,165)";
	}

	function scrollMenu(currentIndex, direction)
	{
		if(direction === "left")
		{
			if(currentIndex === 0)
			{
				index = max;
			navImg = "./img/UI/pg"+index+".png";
			scrollLabel(index);

			}
			else
			{
				index = currentIndex-1;
				navImg = "./img/UI/pg"+index+".png";
				scrollLabel(index);
			}
		}
		if(direction === "right")
		{
			if(currentIndex === max)
			{
				index = 0;
				navImg = "./img/UI/pg"+index+".png";
				scrollLabel(index);
			}
		else
			{
				index = currentIndex+1;
				navImg = "./img/UI/pg"+index+".png";
				scrollLabel(index);
			
			}
		}
	}
	function scrollLabel(currentPage)
	{
		switch (currentPage) {
			case 0:
				navLabel = "dEmoLog";
				break;
			case 1:
				navLabel = "Home";
				
				break;
			case 2:
				navLabel = "Beastiary";
				break;
			case 3:
				navLabel = "Vent";
				break;
			case 4:
				navLabel = "Records";
				break;
			case 5:
				navLabel = "Composition";
				break;
		
			default:
				navLabel = "dEmoLog";
				break;
		}
	}
	function altNav(page)
	{
		scrollLabel(page);
		navImg = "./img/UI/pg"+page+".png";
		index = page;
	}


let aHistory =""
	let aCurrent =""
	function handleSubNav(subNav, i)
	{
		aCurrent = document.getElementById(subNav+i)

		if(aHistory === "") // if empty at start, set both history and selection as selected.
		{
			
			aHistory = aCurrent
			aCurrent.style.background="#f6f6f6"
		}
		if(aHistory === aCurrent)
		{
			// do nothing cuz clicked on same
		}
		if(aCurrent !== aHistory) //if selecting different li
		{
			aHistory.style.background ="#EDEAE5" // history li to not highlighted
			
			aCurrent.style.background="#f6f6f6" // 
			aHistory = aCurrent
			
		}
	}
	
</script>
<div class="container">
	<div class="mini-container">
		<div class="COF-wheel">
		<div id="help">
		<p><button id="tutBtn" on:click={()=> toggleTutorial()}>&#9776;</button></p>

	{#if help === true}
	<div id="help-box" transition:slide="{{duration: 300 }}">
		<div id="help-0" class="helpBoundary">
			<a href="#s" on:click={()=> altNav(0)}>dEmoLog</a>
			
		</div>
		<div id="help-1" class="helpBoundary">
			<a href="#s" on:click={()=> altNav(1)}>Home</a>
			
		</div>
		<div id="help-2" class="helpBoundary">
			<a href="#s" on:click={()=> altNav(2)}>Beastiary</a>
			
		</div>
		<div id="help-3" class="helpBoundary">
			<a href="#s" on:click={()=> altNav(3)}>Vent</a>
			
		</div>
		<div id="help-4" class="helpBoundary">
			<a href="#s" on:click={()=> altNav(4)}>Records</a>
			
		</div>
		<div id="help-5" class="helpBoundary">
			<a href="#s" on:click={()=> altNav(5)}>Composition</a>
			
		</div>
	</div>
	{/if}
	</div>
			<div id="scroller">
			
			<table>
			<tr>
			<td colspan="3" class="fixedImgHolder">
			{#key navImg}
				<img in:fade="{{delay:100 , duration: 300}}" id="appIcon" src={navImg} alt="appIcon" />
			{/key}
			</td>
			</tr>
			<tr class="fixedLabelHolder">
			<td><img id="sliderBtn" src="./img/UI/arrow_L.png" alt="leftArrow" on:click={()=> scrollMenu(index,"left")}/></td>
				<td>{#key navLabel}
					<span in:fade="{{delay:100 , duration: 300}}" id= "appTitleFont">{navLabel}</span>
					{/key}
				</td>
			<td><img id="sliderBtn" src="./img/UI/arrow_R.png" alt="rightArrow" on:click={()=> scrollMenu(index,"right")}/></td>
			</tr>
			</table>
			
			<br>
			
				
			
			</div>
		</div>
		<!-- INTRO START-->
		
		<div class="song-detail">
		{#if index != 0}
		<div class="song-detail-left">
					<div class="list-header">
					</div>
					<div class="list-container">
					{#if index === 1}
						<ul>
						{#each HomeArr as subNav, i}
							<li>
							<a id={subNav+i} href="#" 
								on:click={()=>handleSubNav(subNav, i)}
								 >{subNav}</a>
							</li>
							{/each}		
						</ul>
					{/if}
					{#if index === 2}
						<ul>
						{#each BeastArr as subNav, i}
							<li>
							<a id={subNav+i} href="#" 
								on:click={()=>handleSubNav(subNav, i)}
								 >{subNav}</a>
							</li>
							{/each}		
						</ul>
					{/if}
					{#if index === 3}
						<ul>
						{#each VentArr as subNav, i}
							<li>
							<a id={subNav+i} href="#" 
								on:click={()=>handleSubNav(subNav, i)}
								 >{subNav}</a>
							</li>
							{/each}		
						</ul>
					{/if}
					{#if index === 4}
						<ul>
						{#each RecordsArr as subNav, i}
							<li>
							<a id={subNav+i} href="#" 
								on:click={()=>handleSubNav(subNav, i)}
								 >{subNav}</a>
							</li>
							{/each}		
						</ul>
					{/if}
					{#if index === 5}
						<ul>
						{#each CompArr as subNav, i}
							<li>
							<a id={subNav+i} href="#" 
								on:click={()=>handleSubNav(subNav, i)}
								 >{subNav}</a>
							</li>
							{/each}		
						</ul>
					{/if}					
					</div>
			</div>
			{/if}
			<div class="introBox">
			{#if index === 0}
				<span class="description-header">About</span>
				<p>The Demon Emotion Log abbreviated: dEmoLog, is an prototype app that integrates game elements (gamification) to the traditional Mood Diary concept. <br>
				The hope is that with Gamification added, users would have increased motivation to log their moods regularly, thus aiding their management of mental health.<br>
				</p>
				<br>
				<span class="description-header">Gamification</span>
					<p>Some Gamification elements integrated in the app include:<br>
					- Narrative: create an immersive backstory/setting<br>
					- Aesthetic: an specific aesthetic of artwork for further immersion<br>
					- Game Mechanics: taking away mundaneness of emotion logging by turning task into a gaming experience<br>
					- Progression: sustaining user interest through working towards goals in app
					</p>
					<br>
				<span class="description-header">Experimental Sonification of Emotions</span>
					<p>-Sonification of Emotions aka, Composition in the app refers to the feature that converts emotions into music.<br>
					- The idea is to allow users to 'listen/playback' their emotions so they could possibly gain insights they otherwise would not if they were to read them traditionally. <br>
					- Data from each emotion log would be used to generate an emotion piece. 
				</p>
				<br>
					<span>Notes</span>
					<p>- Work in progress: Composition<br>
					- Current info is accurate as of 8 Jan 2021
				</p>
			{/if}
			{#if index === 1}
			<span class="description-header">Home</span>
				<p>"They say home is where the heart is. But here, home is where your mind is." 
				</p>
			{/if}
			{#if index === 2}
			<span class="description-header">Beastiary</span>
				<p>"Hey, wouldn't it be nice if there was a way to beat them? Out of sight out of mind..."
				</p>
			{/if}
			{#if index === 3}
			<span class="description-header">Vent</span>
				<p>"It would seem that they can be vanquished with emotions..."<br>
				"Its not safe... here take these tomes, they're catalysts to manifest your emotions as ammunitions... Happy hunting!"
				</p>
			{/if}
			{#if index === 4}
			<span class="description-header">Records</span>
				<p>"Perhaps logging these emotions every instance I vent would allow me to recall what happened and be more efficient..."
				</p>
			{/if}
			{#if index === 5}
			<span class="description-header">Composition</span>
				<p>"Recall? Can I recall? Did you know, some people say music"
				</p>
			{/if}
			</div>
		</div>
		
		<!-- INTRO END-->
		
	</div>
</div>
	<footer>
		<span id="home" on:click={()=>{intro = true}}>dEmoLog</span>
		<br>
		<p>created by <a href="https://github.com/5v1n0" target="_blank">5v1n0</a></p>
	</footer>