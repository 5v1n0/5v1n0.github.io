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

	//UI ELEMENTS//////////
	$: {
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
</script>
<div class="container">
	<div class="mini-container">
		<div class="COF-wheel">
		<div id="help">
		<p><button id="tutBtn" on:click={()=> toggleTutorial()}>Features</button></p>

	{#if help === true}
	<div id="help-box" transition:slide="{{duration: 300 }}">
		<div id="help-1" class="helpBoundary">
			<a href="#s" on:click={()=> toggleGifBlinder(1)}>Beastiary</a>
			{#if toggleGif === 1}
			<p>Immersion: Envisioning mental illnesses as Demons, complete with lore.<br></p>
			<p>Choose the demon you want to vanquish.</p>
			<p>Unlock new demons.</p>
			<div transition:slide="{{duration: 300 }}" class="gifHolder">
			<img id="tut1" src="./img/Beastiary.gif" alt="tut1"/>
			</div>
			{/if}
		</div>
		<div id="help-2" class="helpBoundary">
			<a href="#s" on:click={()=> toggleGifBlinder(2)}>Vent</a>
			{#if toggleGif === 2}
			<p>Gameplay: Choose 3 of 9 available emotions to begin emotion logging.<br></p>
			<p>Vanquish your inner demon by attacking with emotions you feel strongly about.</p>
			<div transition:slide="{{duration: 300 }}">
				<img id="tut2" src="./img/Vent.gif" alt="tut2"/>
				</div>
			{/if}
		</div>
		<div id="help-3" class="helpBoundary">
			<a href="#s" on:click={()=> toggleGifBlinder(3)}>Records</a>
			{#if toggleGif === 3}
			<p>Review your emotion logs to reflect.<br></p>
			<p>You may add short personal notes for more details.</p>
			<div transition:slide="{{duration: 300 }}">
				<img id="tut3" src="./img/Records.gif" alt="tut3"/>
				</div>
			{/if}
		</div>
		<div id="help-4" class="helpBoundary">
			<a href="#s" on:click={()=> toggleGifBlinder(4)}>Progression</a>
			{#if toggleGif === 4}
			<p>Inventory tracks loots collected from Venting.<br></p>
			<p>Use acquired items to unlock new demon targets.</p>
			<div transition:slide="{{duration: 300 }}">
				<img id="tut4" src="./img/Progression.gif" alt="tut4"/>
				</div>
			{/if}
		</div>
		<div id="help-5" class="helpBoundary">
			<a href="#s" on:click={()=> toggleGifBlinder(5)}>Composition</a>
			{#if toggleGif === 5}
			<p>-WORK IN PROGRESS-</p>
			<div transition:slide="{{duration: 300 }}">
				<img id="tut5" src="" alt="tut5"/>
				</div>
			{/if}
		</div>
		<div id="help-6" class="helpBoundary">
			<a href="#s" on:click={()=> toggleGifBlinder(6)}>Friends</a>
			{#if toggleGif === 6}
			<p>-WORK IN PROGRESS-</p>
			<div transition:slide="{{duration: 300 }}">
				<img id="tut6" src="" alt="tut6"/>
				</div>
			{/if}
		</div>
	</div>
	{/if}
	</div>
		<p class="select-container">

			
		
		<img id="appIcon" src="./img/UI/composition.png" alt="appIcon"/>
		<br>
		<span id= "appTitleFont">dEmoLog</span>
		
		</div>
		<!-- INTRO START-->
		
		<div class="song-detail">
			<div class="introBox">
				<span class="description-header">About</span>
				
				<p>The Demon Emotion Log abbreviated: dEmoLog, is an prototype app that integrates game elements (gamification) to the traditional Mood Diary concept. <br>
				The hope is that with Gamification added, users would have increased motivation to log their moods regularly, thus aiding their management of mental health.<br>
				Check out the <a id="pingSource" href="#" 
				on:mouseover={ () => pingTutorialIn() }
				on:mouseout={ () => pingTutorialOut() }
				>Features</a> for a quick highlight of what the app offers. ** GIFs not indicative of final app look.
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