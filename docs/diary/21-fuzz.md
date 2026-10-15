# Chapter 21: Random clicks, written down first

*Posted Wednesday, October 14, 2026, at 10:57 PM*

![Two sheets side by side, the steps predicted before the run and what happened, with two mismatches traced to two causes](heroes/21-fuzz.png)

Clicking around at random is a good way to find bugs,
but only if you know what should have happened,
so I asked for a random tester that writes down its guesses first.

Each run starts from a number, and the same number gives the same clicks.
From it the tester picks forty steps a person might take,
like opening tabs, switching skins and typing.
Using the front page and the design notes,
it writes down what should happen after each step
and seals that list before skindeep starts.
Then it runs the steps in a hidden window, takes pictures,
and lists every place where what happened doesn't match the guess.
A person looks at those pictures and decides which are real bugs.

The first batch ran sixteen numbers across all four skins.
Fourteen runs were clean, the other two gave twelve surprises,
and all but one came from two causes in the menu's list of sessions.
With many sessions, the list ran off the bottom of the window,
and it redrew itself every two seconds,
so an entry could slide under the mouse as you clicked.
Now the list scrolls inside the window, and nothing in it moves.

Filed under: testing, menus, bugs
