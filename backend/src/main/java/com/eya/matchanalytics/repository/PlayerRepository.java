package com.eya.matchanalytics.repository;

import com.eya.matchanalytics.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, Long> { }
