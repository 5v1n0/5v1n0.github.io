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
	let showRightInnerLeft = false;
	let error = false;
	let intro = true;
	let help = false;
	let readyToNodeWheel = false;
	let loadedCoords = false;


	let index = 0; // page load, default index
	let max = 5; // how many pages there are

	let navImg = "./img/UI/pg"+index+".png";
	let navLabel = "dEmoLog";
	let subNavTrack = "";
	

	let HomeArr = ["Home", "Avatar", "Inventory"];
	let BeastArr = ["Beastiary", "Lore", "Select", "Unlock"];
	let VentArr = ["Vent", "Emotion Tomes", "Loots", "Vanquish"];
	let RecordsArr = ["Records", "Calendar", "Notes"];
	let CompArr = ["Composition", "-WIP-"];
	

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
				subNavTrack ="";

			}
			else
			{
				index = currentIndex-1;
				navImg = "./img/UI/pg"+index+".png";
				scrollLabel(index);
				subNavTrack ="";
			}
		}
		if(direction === "right")
		{
			if(currentIndex === max)
			{
				index = 0;
				navImg = "./img/UI/pg"+index+".png";
				scrollLabel(index);
				subNavTrack ="";
			}
		else
			{
				index = currentIndex+1;
				navImg = "./img/UI/pg"+index+".png";
				scrollLabel(index);
				subNavTrack ="";
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
		subNavTrack ="";
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
		subNavTrack = subNav;
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
				<p>The Demon Emotion Log abbreviated: dEmoLog, is an app prototype that integrates game elements (gamification) to the traditional Mood Diary concept. <br>
				The hope is that with Gamification added, users would have increased motivation to log their moods regularly, thus aiding their management of mental health.<br>
				</p>
				<br>
				<div id="right-inner-right">	
	<div id="blinder">
	<label for="toggleShowHideCheck">&#x25D3;</label>
		<input id="toggleShowHideCheck" type="checkbox" class="check-box" bind:checked={showRightInnerLeft}>
		<hr>
	</div>
	</div>
 	{#if showRightInnerLeft === true}
	<div class="right-inner-left" transition:slide="{{duration: 300 }}">
	<span class="description-header">Developer Notes</span>
		<span><u>Gamification Integration</u></span>
					<p>Some Gamification elements integrated in the app include:<br>
					- Narrative: create an immersive backstory/setting<br>
					- Aesthetic: an specific aesthetic of artwork for further immersion<br>
					- Game Mechanics: taking away mundaneness of emotion logging by turning task into a gaming experience<br>
					- Progression: sustaining user interest by working towards goals in app
					</p>
				<br>
		<span><u>Experimental Sonification of Emotions</u></span>
					<p>-Sonification of Emotions aka, Composition in the app refers to the feature that converts emotions into music.<br>
					- The idea is to allow users to 'listen/playback' their emotions so they could possibly gain insights they otherwise would not if they were to read them traditionally. <br>
					- Data from each emotion log would be used to generate an emotion piece. 
					</p>
				<br>
		<span><u>Current Progress</u></span>
					<p>- Work in progress: Composition<br>
					- Current info is accurate as of 14 Jan 2021
					</p>
	</div>
	{/if}

			
					
			{/if}
			{#if index === 1 && subNavTrack === "" || subNavTrack === "Home"}
			<div in:fade="{{delay:100 , duration: 300}}">
			<span class="description-header">Home</span>
				<p>The Homepage of the app, where you can access to all features. 
				</p>
				<br>
				<img class="gifHolder" src="./img/pageItems/home_forever.gif" alt="homeGif"/>
			</div>
			{/if}
				{#if subNavTrack === "Avatar"}
				<span class="description-header">Concept: Avatar</span>
					<p>In dEmoLog, you are represented as Pens.<br> I suppose it is fitting seeing you are both the protagonist and author of your own story.</p>
					<br>
					<br>
					<img src="./img/pageItems/qpen.png" alt="quillPen"/>
					
				{/if}
				{#if subNavTrack === "Inventory"}
				<span class="description-header">Feature: Inventory</span>
					<p>Who doesn't like goodies? Gotta store all these loots from demon hunting someplace.<br> Who knows? They might be useful...</p>
					<br>
					<img class="gifHolder" src="./img/pageItems/inventory_once.gif" alt="inventoryGif"/>
				{/if}
				<!--
				{#if subNavTrack === "Grimoire"}
				<span class="description-header">Concept: Grimoire</span>
					<p>Well, the Grimoire goes by many names. Also commonly known as the Beastiary. It basically holds information about demons encountered.<br> 
					Think of it as an encyclopedia if that's easier to fathom.</p>
					<br>
					<img height="300px" src="./img/UI/pg2.png" alt="Beastiary"/>
				{/if}
				-->
			{#if index === 2 && subNavTrack === "" || subNavTrack === "Beastiary"}
			<span class="description-header">Beastiary</span>
				<p>The Beastiary page is where information about Demons is stored. <br></p>
				<br>
				<img class="gifHolder" src="./img/pageItems/beastiary_forever.gif" alt="beastiaryGif"/>
			{/if}
				{#if subNavTrack === "Lore"}
				<span class="description-header">Feature: Lore</span>
					<p>Backstory of each Demons. How quaint. Were they truly monsters to begin with?</p>
					<br>
					<img class="gifHolder" src="./img/pageItems/beastiary_lore_once.gif" alt="beastiaryLore"/>
				{/if}
				{#if subNavTrack === "Select"}
				<span class="description-header">Feature: Select</span>
					<p>Here's an interesting connection the Beastiary has, to the Mirror world; you can select which Demon you want to Vent at.</p>
					<br>
					<img class="gifHolder" src="./img/pageItems/beastiary_select_once.gif" alt="beastiarySelect"/>
				{/if}
				{#if subNavTrack === "Unlock"}
				<span class="description-header"> Feature: Unlock</span>
					<p>The Beastiary might know it all but it is not omnipotent. It does however, accept offerings in exchange for new knowledge... </p>
					<br>
					<img class="gifHolder" src="./img/pageItems/beastiary_unlock_once.gif" alt="beastiaryUnlock"/>
				{/if}
			{#if index === 3 && subNavTrack === "" || subNavTrack === "Vent"}
			<span class="description-header">Vent</span>
				<p>The Vent page is where to vanquish demons.<br></p>
				<br>
					<img class="gifHolder" src="./img/pageItems/vent_forever.gif" alt="VentGif"/>
			{/if}
				{#if subNavTrack === "Emotion Tomes"}
				<span class="description-header">Concept: Emotion Tomes</span>
					<p>Each emotion tome is representative of an emotion. You are able to wield your emotions through them to launch devastating attacks at demons.</p>
					<img width="600px" src="./img/pageItems/books.png" alt="emotionTomes"/>
				{/if}
				{#if subNavTrack === "Vanquish"}
				<span class="description-header">Feature: Vanquish</span>
					<p>Armed with emotion tomes, you can now damage the demon by Venting on them. <br>
					But remember to only use the tomes you feel most strongly about otherwise, you won't be getting much out of dEmoLog.</p>
					<br>
					<img class="gifHolder" src="./img/pageItems/vent_vanquish_once.gif" alt="VentVanquish"/>
				{/if}
				{#if subNavTrack === "Loots"}
				<span class="description-header">Feature: Loots</span>
					<p>Venting at the demon will drop loots at times. These loots could be useful in the Beastiary... <br>
					Oh, and don't forget to pick them up! They do disappear over time.</p>
					<br>
					<img width="250px" src="./img/pageItems/hornFrag.png" alt="hornFragment"/>
					<img width="250px" src="./img/pageItems/branchFrag.png" alt="branchFragment"/>
				{/if}
			{#if index === 4 && subNavTrack === "" || subNavTrack === "Records"}
			<span class="description-header">Records</span>
				<p>The Records page acts like an archive of sorts that allows you to look back at your past emotion logs for reflection.</p>
				<br>
					<img class="gifHolder" src="./img/pageItems/record_forever.gif" alt="recordGif"/>
			{/if}
				{#if subNavTrack === "Calendar"}
				<span class="description-header">Feature: Calendar</span>
					<p>You can browse through the calendar to look back at your Vent records.<br>
					 Man... I guess I was feeling sad the other day. Huh. How curious. </p>
					 <br>
					<img class="gifHolder" src="./img/pageItems/record_calendar_once.gif" alt="recordCalendar"/>
				{/if}
				{#if subNavTrack === "Notes"}
				<span class="description-header">Feature: Notes</span>
					<p>It might be prudent to edit/append a short note to describe anything else that happened then. <br>
					I can't believe seeing that stranger shouting far away still made me feel so anxious...</p>
					<br>
					<img class="gifHolder" src="./img/pageItems/record_edit_once.gif" alt="recordEdit"/>
				{/if}
			{#if index === 5 && subNavTrack === "" || subNavTrack === "Composition"}
			<span class="description-header">Composition</span>
				<p>"Recall? Can I recall? Did you know, some people say that music triggers memories."</p>
			{/if}
				{#if subNavTrack === "-WIP-"}
				<span class="description-header">Work IN progress</span>
					<p>"test"</p>
				{/if}
			</div>
		</div>
		
		<!-- INTRO END-->
		
	</div>
</div>
	<footer>
		<span id="dEmoLog" on:click={()=> altNav(0)}>dEmoLog</span>
		<br>
		<p>created by <a href="https://github.com/5v1n0" target="_blank">5v1n0</a></p>
	</footer>