# Closed test and finding testers (draft)

How to run the Play closed test and find testers who are strangers (issue #601, part of #445). The author does not want to
ask people they know. Play wording changes, so read the Console again when acting (last checked 2026-10-17).

## What Play asks

Source: the Console's Production page and the
[Play help page](https://support.google.com/googleplay/android-developer/answer/14151465). Some web pages say 20 testers;
the Console for this account says 12, so plan for 12.

1. Publish a closed testing release.
2. Have at least 12 testers opted in (0 on 2026-10-17).
3. Run the closed test with at least 12 testers for at least 14 days in a row.

Testers who opt out before the 14 days do not count, and an opt out and back in must still add up to 14 days in a row. When
applying, there are questions about the closed test, so read "Preview questions" on the Production page early. The pre-launch
report can be turned on for the closed track. Tester feedback is private and does not touch the public rating; replies are
written in the Console. Recruit 15 to 18, because some drop out or never opt in.

## Setting up the track

1. Make a Google Group (groups.google.com), for example `beaver-cycle-testers`, set to "anyone can ask to join". With
   strangers a Group is easier than an email list, because people join and the author only approves.
2. Closed testing > Testers: choose Google Groups and enter the Group address. Put the contact email in "Feedback URL or
   email address".
3. Put a release on the track (the same `.aab`, or a new one with a higher `versionCode`) and send it for review.
4. When live, copy the opt-in link from the Testers tab. Testers need a Google account and an Android device, join the
   Group, open the link signed in, tap "Become a tester", and install from Play.
5. Note the day the test went live. Keep 12 or more opted in for 14 days in a row.

## Where to find strangers

- r/AndroidClosedTesting, the main place. Most posts are swaps: you test their app for 14 days, they test yours.
- r/TestersCommunity, built around this requirement. Its guide says to post the opt-in link and Group link with a short
  description and the feedback wanted.
- Paid tester packages only as a last resort. Success claims there are the vendors' own.
- Swap partners drop out, so keep a buffer, and keep the promise to test their apps.

## Starting on Reddit

1. Make an account at reddit.com with an email and a neutral public username.
2. Warm it up for a few days: join other communities, comment honestly, upvote. Brand new accounts with no history are
   often removed by subreddits.
3. Join both subreddits above (search, then Join).
4. Read each one's sidebar, "About" and pinned posts before posting: the title format and what gets removed. Search the
   subreddit for "swap" and copy what works.
5. Test other people's apps while asking for yours. Posts that only ask are ignored.
6. Post only once the opt-in link and the Group link exist.

## Post to adapt

Title: `[Swap] Beaver Cycle, a calm 3D beaver game (Android), testers needed for 14 days`

> I'm testing my game Beaver Cycle, a calm 3D game where you play a beaver in a real Alpine valley in Austria. You build
> dams and lodges and raise a family. No ads, no tracking, free.
>
> I need 12+ testers opted in for 14 days for Google Play's closed test. I will test your app for 14 days too, so reply
> with your link.
>
> 1. Join the group: (Group link)
> 2. Opt in on Google Play: (opt-in link)
> 3. Install it and play a few minutes a day.
>
> Feedback, anything including "it crashed" or "I was bored": (feedback email)
>
> Please keep it installed for the full 14 days. Thanks!

## Risks

- A Play install cannot go over a debug signed build, and there is no save export or import yet.
- Re-check that `src/` has no network call or analytics before each release (the Data safety answer says nothing is
  collected), and raise `versionCode` for every upload.
