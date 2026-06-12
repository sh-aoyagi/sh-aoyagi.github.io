-- ================================================================
-- ぽっちゃりんぐ — Supabase Schema
-- Supabase Dashboard > SQL Editor で実行してください
-- ================================================================

-- 1. プロフィール（auth.users を拡張）
CREATE TABLE public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role         TEXT NOT NULL CHECK (role IN ('pocchary', 'browser')),
  gender       TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  display_name TEXT NOT NULL,
  age          INTEGER NOT NULL CHECK (age >= 25),
  bio          TEXT DEFAULT '',
  photo_url    TEXT DEFAULT '',
  is_premium   BOOLEAN DEFAULT FALSE,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: 全員が読める"     ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles: 自分のみ作成"     ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: 自分のみ更新"     ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. いいね（browser → pocchary）
CREATE TABLE public.likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  browser_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pocchary_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(browser_id, pocchary_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes: 当事者のみ参照"   ON public.likes FOR SELECT TO authenticated
  USING (auth.uid() = browser_id OR auth.uid() = pocchary_id);
CREATE POLICY "likes: browserが作成"    ON public.likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = browser_id);
CREATE POLICY "likes: poccharyが更新"   ON public.likes FOR UPDATE TO authenticated
  USING (auth.uid() = pocchary_id);

-- 3. マッチ
CREATE TABLE public.matches (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  browser_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pocchary_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status             TEXT DEFAULT 'active' CHECK (status IN ('active', 'dissolved')),
  browser_msg_count  INTEGER DEFAULT 0,
  pocchary_msg_count INTEGER DEFAULT 0,
  dissolved_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(browser_id, pocchary_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches: 当事者のみ参照" ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() = browser_id OR auth.uid() = pocchary_id);
CREATE POLICY "matches: poccharyが作成" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = pocchary_id);
CREATE POLICY "matches: 当事者のみ更新" ON public.matches FOR UPDATE TO authenticated
  USING (auth.uid() = browser_id OR auth.uid() = pocchary_id);

-- 4. メッセージ
CREATE TABLE public.messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  sender_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages: 当事者のみ参照" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.browser_id = auth.uid() OR m.pocchary_id = auth.uid())
  ));
CREATE POLICY "messages: 当事者のみ送信" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.status = 'active'
      AND (m.browser_id = auth.uid() OR m.pocchary_id = auth.uid())
    )
  );

-- 5. ブロック
CREATE TABLE public.blocks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks: 自分のみ操作" ON public.blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- 6. トリガー: メッセージ送信でカウントアップ & 上限チェック
CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match    public.matches%ROWTYPE;
  v_sender   public.profiles%ROWTYPE;
  v_browser  public.profiles%ROWTYPE;
  v_pocchary public.profiles%ROWTYPE;
  v_b_limit  INTEGER;
  v_p_limit  INTEGER;
BEGIN
  SELECT * INTO v_match   FROM public.matches  WHERE id = NEW.match_id;
  SELECT * INTO v_sender  FROM public.profiles WHERE id = NEW.sender_id;
  SELECT * INTO v_browser FROM public.profiles WHERE id = v_match.browser_id;
  SELECT * INTO v_pocchary FROM public.profiles WHERE id = v_match.pocchary_id;

  v_b_limit := CASE WHEN v_browser.is_premium  THEN 30 ELSE 10 END;
  v_p_limit := CASE WHEN v_pocchary.is_premium THEN 30 ELSE 10 END;

  IF v_sender.role = 'browser' THEN
    UPDATE public.matches SET browser_msg_count  = browser_msg_count  + 1 WHERE id = NEW.match_id;
  ELSE
    UPDATE public.matches SET pocchary_msg_count = pocchary_msg_count + 1 WHERE id = NEW.match_id;
  END IF;

  -- 再取得して双方が上限に達したら解消
  SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;
  IF v_match.browser_msg_count >= v_b_limit AND v_match.pocchary_msg_count >= v_p_limit THEN
    UPDATE public.matches SET status = 'dissolved', dissolved_at = NOW() WHERE id = NEW.match_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message();

-- 7. リアルタイム有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;

-- ================================================================
-- Storage: Dashboard > Storage > New bucket
--   名前: poccharing-avatars
--   Public: ON（チェックを入れる）
-- ================================================================
